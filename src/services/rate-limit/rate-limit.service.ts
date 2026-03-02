/**
 * Rate Limiting Service - Redis-based rate limiting
 * Implements sliding window and token bucket algorithms
 */

import { Redis } from 'ioredis';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  max: number;      // Maximum requests per window
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;    // Timestamp when limit resets
  retryAfter?: number; // Seconds to wait before retry
}

export interface RateLimitInfo {
  total: number;
  remaining: number;
  reset: number;
}

class RateLimitService {
  private redis: Redis | null = null;
  private enabled = true;

  // Default configurations
  private readonly DEFAULT_LIMITS = {
    search: { windowMs: 3600000, max: 10 },      // 10 searches per hour
    api: { windowMs: 60000, max: 60 },           // 60 API calls per minute
    auth: { windowMs: 900000, max: 5 },          // 5 auth attempts per 15 minutes
    upload: { windowMs: 3600000, max: 20 },      // 20 uploads per hour
    export: { windowMs: 3600000, max: 5 },       // 5 exports per hour
  };

  /**
   * Initialize Redis connection
   */
  async connect(connectionString?: string): Promise<void> {
    try {
      const url = connectionString || process.env.REDIS_URL;
      if (!url) {
        console.warn('Redis URL not provided, rate limiting disabled');
        this.enabled = false;
        return;
      }

      this.redis = new Redis(url, {
        maxRetriesPerRequest: 3,
      });

      await this.redis.ping();
      console.log('Rate limiting service initialized');
    } catch (error) {
      console.warn('Failed to connect to Redis, rate limiting disabled:', error);
      this.enabled = false;
    }
  }

  /**
   * Generate rate limit key
   */
  private generateKey(identifier: string, type: string): string {
    return `ratelimit:${type}:${identifier}`;
  }

  /**
   * Sliding window rate limiting
   * More accurate than fixed window, prevents boundary attacks
   */
  async slidingWindowLimit(
    identifier: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    if (!this.enabled || !this.redis) {
      return { success: true, remaining: config.max, reset: Date.now() + config.windowMs };
    }

    const now = Date.now();
    const windowStart = now - config.windowMs;
    const key = this.generateKey(identifier, 'sliding');

    try {
      // Use Redis pipeline for atomic operations
      const pipeline = this.redis.pipeline();
      
      // Remove old entries outside the window
      pipeline.zremrangebyscore(key, 0, windowStart);
      
      // Add current request
      pipeline.zadd(key, now, `${now}:${Math.random()}`);
      
      // Count requests in window
      pipeline.zcard(key);
      
      // Set expiry on the key
      pipeline.expire(key, Math.ceil(config.windowMs / 1000));

      const results = await pipeline.exec();
      
      if (!results) {
        return { success: true, remaining: config.max, reset: now + config.windowMs };
      }

      const count = (results[2][1] as number) || 0;
      const remaining = Math.max(0, config.max - count);
      const reset = now + config.windowMs;

      if (count > config.max) {
        return {
          success: false,
          remaining: 0,
          reset,
          retryAfter: Math.ceil(config.windowMs / 1000),
        };
      }

      return {
        success: true,
        remaining,
        reset,
      };
    } catch (error) {
      console.error('Rate limit error:', error);
      // Fail open - allow request if rate limiting fails
      return { success: true, remaining: config.max, reset: now + config.windowMs };
    }
  }

  /**
   * Token bucket rate limiting
   * Allows bursting while maintaining average rate
   */
  async tokenBucketLimit(
    identifier: string,
    config: RateLimitConfig & { bucketSize?: number }
  ): Promise<RateLimitResult> {
    if (!this.enabled || !this.redis) {
      return { success: true, remaining: config.max, reset: Date.now() + config.windowMs };
    }

    const now = Date.now();
    const key = this.generateKey(identifier, 'bucket');
    const bucketSize = config.bucketSize || config.max;
    const refillRate = config.max / (config.windowMs / 1000); // tokens per second

    try {
      const data = await this.redis.get(key);
      let tokens = bucketSize;
      let lastRefill = now;

      if (data) {
        const parsed = JSON.parse(data);
        tokens = parsed.tokens;
        lastRefill = parsed.lastRefill;

        // Calculate token refill
        const elapsed = (now - lastRefill) / 1000;
        tokens = Math.min(bucketSize, tokens + elapsed * refillRate);
      }

      if (tokens < 1) {
        const reset = now + Math.ceil((1 - tokens) / refillRate * 1000);
        return {
          success: false,
          remaining: Math.floor(tokens),
          reset,
          retryAfter: Math.ceil((1 - tokens) / refillRate),
        };
      }

      // Consume token
      tokens -= 1;
      await this.redis.setex(
        key,
        Math.ceil(config.windowMs / 1000),
        JSON.stringify({ tokens, lastRefill: now })
      );

      return {
        success: true,
        remaining: Math.floor(tokens),
        reset: now + config.windowMs,
      };
    } catch (error) {
      console.error('Token bucket rate limit error:', error);
      return { success: true, remaining: config.max, reset: now + config.windowMs };
    }
  }

  /**
   * Check search rate limit
   */
  async checkSearchLimit(identifier: string): Promise<RateLimitResult> {
    return this.slidingWindowLimit(identifier, this.DEFAULT_LIMITS.search);
  }

  /**
   * Check API rate limit
   */
  async checkApiLimit(identifier: string): Promise<RateLimitResult> {
    return this.slidingWindowLimit(identifier, this.DEFAULT_LIMITS.api);
  }

  /**
   * Check auth rate limit
   */
  async checkAuthLimit(identifier: string): Promise<RateLimitResult> {
    return this.slidingWindowLimit(identifier, this.DEFAULT_LIMITS.auth);
  }

  /**
   * Check upload rate limit
   */
  async checkUploadLimit(identifier: string): Promise<RateLimitResult> {
    return this.slidingWindowLimit(identifier, this.DEFAULT_LIMITS.upload);
  }

  /**
   * Check export rate limit
   */
  async checkExportLimit(identifier: string): Promise<RateLimitResult> {
    return this.slidingWindowLimit(identifier, this.DEFAULT_LIMITS.export);
  }

  /**
   * Get current rate limit info
   */
  async getLimitInfo(
    identifier: string,
    type: 'search' | 'api' | 'auth' | 'upload' | 'export'
  ): Promise<RateLimitInfo> {
    const config = this.DEFAULT_LIMITS[type];
    const result = await this.slidingWindowLimit(identifier, config);
    
    return {
      total: config.max,
      remaining: result.remaining,
      reset: result.reset,
    };
  }

  /**
   * Reset rate limit for identifier
   */
  async reset(identifier: string): Promise<void> {
    if (!this.enabled || !this.redis) return;

    try {
      const keys = await this.redis.keys(`ratelimit:*:${identifier}`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('Rate limit reset error:', error);
    }
  }

  /**
   * Get all rate limit stats
   */
  async getStats(): Promise<Record<string, number>> {
    if (!this.enabled || !this.redis) {
      return {};
    }

    try {
      const keys = await this.redis.keys('ratelimit:*');
      const stats: Record<string, number> = {
        total: keys.length,
        search: 0,
        api: 0,
        auth: 0,
        upload: 0,
        export: 0,
      };

      for (const key of keys) {
        const parts = key.split(':');
        if (parts.length >= 2) {
          const type = parts[1];
          stats[type] = (stats[type] || 0) + 1;
        }
      }

      return stats;
    } catch (error) {
      console.error('Rate limit stats error:', error);
      return {};
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    if (!this.enabled || !this.redis) return false;
    
    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const rateLimitService = new RateLimitService();

/**
 * Next.js middleware helper
 * Returns a function that can be used in API routes
 */
export function createRateLimiter(
  type: 'search' | 'api' | 'auth' | 'upload' | 'export',
  customConfig?: Partial<RateLimitConfig>
) {
  return async (identifier: string) => {
    const config = rateLimitService['DEFAULT_LIMITS'][type];
    const mergedConfig = { ...config, ...customConfig };
    
    const result = await rateLimitService.slidingWindowLimit(identifier, mergedConfig);
    
    return {
      ...result,
      limit: config.max,
      type,
    };
  };
}
