/**
 * Cache Service - Redis-based caching layer
 * Provides multi-layer caching with automatic invalidation
 */

import { Redis } from 'ioredis';
import { createHash } from 'crypto';

export interface CacheConfig {
  ttl: number; // Time to live in seconds
  prefix?: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
}

class CacheService {
  private redis: Redis | null = null;
  private stats: { hits: number; misses: number } = { hits: 0, misses: 0 };
  private enabled = true;

  // Default TTL configurations
  private readonly DEFAULT_TTL = {
    search: 3600,      // 1 hour
    breach: 86400,     // 24 hours
    risk: 1800,        // 30 minutes
    analysis: 3600,    // 1 hour
    report: 86400,     // 24 hours
  };

  /**
   * Initialize Redis connection
   */
  async connect(connectionString?: string): Promise<void> {
    try {
      const url = connectionString || process.env.REDIS_URL;
      if (!url) {
        console.warn('Redis URL not provided, cache disabled');
        this.enabled = false;
        return;
      }

      this.redis = new Redis(url, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) return null;
          return Math.min(times * 200, 2000);
        },
      });

      this.redis.on('error', (error) => {
        console.error('Redis connection error:', error);
        this.enabled = false;
      });

      this.redis.on('connect', () => {
        console.log('Redis connected successfully');
      });

      // Test connection
      await this.redis.ping();
      console.log('Cache service initialized');
    } catch (error) {
      console.warn('Failed to connect to Redis, cache disabled:', error);
      this.enabled = false;
    }
  }

  /**
   * Generate cache key from parameters
   */
  private generateKey(prefix: string, data: any): string {
    const hash = createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex')
      .slice(0, 16);
    return `${prefix}:${hash}`;
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled || !this.redis) {
      this.stats.misses++;
      return null;
    }

    try {
      const value = await this.redis.get(key);
      if (value) {
        this.stats.hits++;
        return JSON.parse(value) as T;
      }
      this.stats.misses++;
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    if (!this.enabled || !this.redis) {
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.redis.setex(key, ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    if (!this.enabled || !this.redis) {
      return false;
    }

    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  async deleteByPattern(pattern: string): Promise<number> {
    if (!this.enabled || !this.redis) {
      return 0;
    }

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) return 0;
      return await this.redis.del(...keys);
    } catch (error) {
      console.error('Cache deleteByPattern error:', error);
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.enabled || !this.redis) {
      return false;
    }

    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Get or set with fallback function
   */
  async getOrSet<T>(
    key: string,
    fn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fn();
    await this.set(key, value, ttl);
    return value;
  }

  // === Convenience Methods ===

  /**
   * Cache search results
   */
  async cacheSearchResults(
    query: any,
    results: any[],
    ttl?: number
  ): Promise<void> {
    const key = this.generateKey('search', query);
    await this.set(key, { results, timestamp: Date.now() }, ttl || this.DEFAULT_TTL.search);
  }

  /**
   * Get cached search results
   */
  async getCachedSearchResults(query: any): Promise<any[] | null> {
    const key = this.generateKey('search', query);
    const cached = await this.get<{ results: any[]; timestamp: number }>(key);
    return cached?.results || null;
  }

  /**
   * Cache breach data
   */
  async cacheBreachData(
    identifier: string,
    data: any,
    ttl?: number
  ): Promise<void> {
    const key = this.generateKey('breach', { identifier });
    await this.set(key, { data, timestamp: Date.now() }, ttl || this.DEFAULT_TTL.breach);
  }

  /**
   * Get cached breach data
   */
  async getCachedBreachData(identifier: string): Promise<any | null> {
    const key = this.generateKey('breach', { identifier });
    const cached = await this.get<{ data: any; timestamp: number }>(key);
    return cached?.data || null;
  }

  /**
   * Cache risk assessment
   */
  async cacheRiskAssessment(
    investigationId: string,
    assessment: any,
    ttl?: number
  ): Promise<void> {
    const key = this.generateKey('risk', { investigationId });
    await this.set(key, { assessment, timestamp: Date.now() }, ttl || this.DEFAULT_TTL.risk);
  }

  /**
   * Get cached risk assessment
   */
  async getCachedRiskAssessment(investigationId: string): Promise<any | null> {
    const key = this.generateKey('risk', { investigationId });
    const cached = await this.get<{ assessment: any; timestamp: number }>(key);
    return cached?.assessment || null;
  }

  /**
   * Invalidate all search caches
   */
  async invalidateSearchCache(): Promise<number> {
    return this.deleteByPattern('search:*');
  }

  /**
   * Clear all caches
   */
  async clearAll(): Promise<void> {
    if (!this.enabled || !this.redis) return;
    
    const patterns = ['search:*', 'breach:*', 'risk:*', 'analysis:*', 'report:*'];
    for (const pattern of patterns) {
      await this.deleteByPattern(pattern);
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
export const cacheService = new CacheService();

// Middleware helper
export function withCache<T>(
  cacheKey: string,
  ttl: number,
  fn: () => Promise<T>
): () => Promise<T> {
  return async () => {
    const cached = await cacheService.get<T>(cacheKey);
    if (cached !== null) return cached;

    const result = await fn();
    await cacheService.set(cacheKey, result, ttl);
    return result;
  };
}
