import Redis from 'ioredis';

/**
 * Redis Cache Manager
 * Provides high-performance caching with automatic connection pooling and retry logic
 */
export class CacheManager {
  private static instance: CacheManager;
  private redis: Redis;
  private isReady: boolean = false;

  private constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      enableReadyCheck: true,
      lazyConnect: false,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000,
    });

    this.redis.on('ready', () => {
      console.log('✅ Redis connection established');
      this.isReady = true;
    });

    this.redis.on('error', (error) => {
      console.error('❌ Redis connection error:', error.message);
      this.isReady = false;
    });

    this.redis.on('close', () => {
      console.log('⚠️  Redis connection closed');
      this.isReady = false;
    });

    this.redis.on('reconnecting', () => {
      console.log('🔄 Reconnecting to Redis...');
    });
  }

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isReady) {
      console.warn('⚠️  Redis not ready, skipping cache get');
      return null;
    }

    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set a value in cache with TTL
   */
  async set<T>(key: string, value: T, ttl: number = 3600): Promise<boolean> {
    if (!this.isReady) {
      console.warn('⚠️  Redis not ready, skipping cache set');
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      await this.redis.setex(key, ttl, serialized);
      return true;
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete a specific key
   */
  async delete(key: string): Promise<boolean> {
    if (!this.isReady) {
      return false;
    }

    try {
      const result = await this.redis.del(key);
      return result > 0;
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Invalidate all keys matching a pattern
   */
  async invalidatePattern(pattern: string): Promise<number> {
    if (!this.isReady) {
      return 0;
    }

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }

      const result = await this.redis.del(...keys);
      console.log(`🗑️  Invalidated ${result} keys matching pattern: ${pattern}`);
      return result;
    } catch (error) {
      console.error(`Cache invalidate error for pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Get multiple values in a single operation
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (!this.isReady || keys.length === 0) {
      return new Array(keys.length).fill(null);
    }

    try {
      const values = await this.redis.mget(...keys);
      return values.map(v => v ? JSON.parse(v) : null);
    } catch (error) {
      console.error('Cache mget error:', error);
      return new Array(keys.length).fill(null);
    }
  }

  /**
   * Set multiple values in a single operation
   */
  async mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<boolean> {
    if (!this.isReady || entries.length === 0) {
      return false;
    }

    try {
      const pipeline = this.redis.pipeline();

      for (const entry of entries) {
        const serialized = JSON.stringify(entry.value);
        const ttl = entry.ttl || 3600;
        pipeline.setex(entry.key, ttl, serialized);
      }

      await pipeline.exec();
      return true;
    } catch (error) {
      console.error('Cache mset error:', error);
      return false;
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isReady) {
      return false;
    }

    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Increment a counter
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    if (!this.isReady) {
      return 0;
    }

    try {
      return await this.redis.incrby(key, amount);
    } catch (error) {
      console.error(`Cache increment error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Get TTL for a key
   */
  async ttl(key: string): Promise<number> {
    if (!this.isReady) {
      return -2;
    }

    try {
      return await this.redis.ttl(key);
    } catch (error) {
      console.error(`Cache TTL error for key ${key}:`, error);
      return -2;
    }
  }

  /**
   * Flush entire cache (use with caution)
   */
  async flushAll(): Promise<boolean> {
    if (!this.isReady) {
      return false;
    }

    try {
      await this.redis.flushdb();
      console.log('🗑️  Cache flushed');
      return true;
    } catch (error) {
      console.error('Cache flush error:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalKeys: number;
    usedMemory: string;
    connectedClients: number;
    uptime: number;
  }> {
    if (!this.isReady) {
      return {
        totalKeys: 0,
        usedMemory: '0B',
        connectedClients: 0,
        uptime: 0,
      };
    }

    try {
      const info = await this.redis.info('stats');
      const memoryInfo = await this.redis.info('memory');

      const parseInfo = (infoString: string, key: string): number => {
        const match = infoString.match(new RegExp(`${key}:(\\d+)`));
        return match ? parseInt(match[1], 10) : 0;
      };

      const parseMemory = (infoString: string, key: string): string => {
        const match = infoString.match(new RegExp(`${key}:(.+)`));
        return match ? match[1].trim() : '0B';
      };

      return {
        totalKeys: parseInfo(info, 'keyspace'),
        usedMemory: parseMemory(memoryInfo, 'used_memory_human'),
        connectedClients: parseInfo(info, 'connected_clients'),
        uptime: parseInfo(info, 'uptime_in_seconds'),
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return {
        totalKeys: 0,
        usedMemory: '0B',
        connectedClients: 0,
        uptime: 0,
      };
    }
  }

  /**
   * Close the Redis connection
   */
  async close(): Promise<void> {
    try {
      await this.redis.quit();
      console.log('✅ Redis connection closed');
    } catch (error) {
      console.error('Redis close error:', error);
    }
  }

  /**
   * Check if Redis is ready
   */
  isRedisReady(): boolean {
    return this.isReady;
  }
}

// Export singleton instance
export const cache = CacheManager.getInstance();

// Default TTLs (in seconds)
export const CacheTTL = {
  SEARCH: parseInt(process.env.CACHE_TTL_SEARCH || '3600', 10),
  ANALYTICS: parseInt(process.env.CACHE_TTL_ANALYTICS || '1800', 10),
  RISK_ASSESSMENT: parseInt(process.env.CACHE_TTL_RISK_ASSESSMENT || '1800', 10),
  API_RESPONSE: parseInt(process.env.CACHE_TTL_API_RESPONSES || '300', 10),
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 3600, // 1 hour
  VERY_LONG: 86400, // 24 hours
};
