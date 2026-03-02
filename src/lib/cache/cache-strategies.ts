import { cache, CacheTTL } from './redis-client';
import { CacheKeys, cacheHitTracker } from './cache-keys';

/**
 * Cache Strategy Types
 */
export type CacheStrategy =
  | 'lookup-aside'
  | 'write-through'
  | 'write-behind'
  | 'refresh-ahead';

/**
 * Cache entry with metadata
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  metadata?: Record<string, unknown>;
}

/**
 * Generic Cache Strategy
 */
export class CacheStrategy<T> {
  private strategy: CacheStrategy;
  private key: string;

  constructor(key: string, strategy: CacheStrategy = 'lookup-aside') {
    this.key = key;
    this.strategy = strategy;
  }

  /**
   * Get data from cache
   */
  async get(): Promise<T | null> {
    try {
      const entry = await cache.get<CacheEntry<T>>(this.key);

      if (entry) {
        const now = Date.now();
        const age = now - entry.timestamp;

        // Check if entry is stale
        if (age > entry.ttl * 1000) {
          console.log(`⚠️  Cache entry stale for key: ${this.key}`);
          // Return stale data but trigger refresh
          this.triggerRefresh().catch(console.error);
        }

        cacheHitTracker.recordHit(this.key);
        return entry.data;
      }

      cacheHitTracker.recordMiss(this.key);
      return null;
    } catch (error) {
      console.error(`Cache get error for key ${this.key}:`, error);
      cacheHitTracker.recordMiss(this.key);
      return null;
    }
  }

  /**
   * Set data in cache
   */
  async set(data: T, ttl?: number): Promise<boolean> {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl: ttl || CacheTTL.MEDIUM,
      };

      const success = await cache.set(this.key, entry, entry.ttl);
      return success;
    } catch (error) {
      console.error(`Cache set error for key ${this.key}:`, error);
      return false;
    }
  }

  /**
   * Get or compute value (lookup-aside pattern)
   */
  async getOrCompute(
    computeFn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get();
    if (cached !== null) {
      return cached;
    }

    // Compute value
    const value = await computeFn();

    // Cache the computed value
    await this.set(value, ttl);

    return value;
  }

  /**
   * Trigger background refresh
   */
  private async triggerRefresh(): Promise<void> {
    console.log(`🔄 Triggering background refresh for: ${this.key}`);
    // Implementation depends on use case
  }

  /**
   * Invalidate cache
   */
  async invalidate(): Promise<boolean> {
    return await cache.delete(this.key);
  }
}

/**
 * Search Cache Strategy
 */
export class SearchCacheStrategy extends CacheStrategy<any[]> {
  async getWithMetadata(): Promise<{ results: any[]; cached: boolean; timestamp?: number } | null> {
    try {
      const entry = await cache.get<CacheEntry<any[]>>(this.key);

      if (entry) {
        cacheHitTracker.recordHit(this.key);
        return {
          results: entry.data,
          cached: true,
          timestamp: entry.timestamp,
        };
      }

      cacheHitTracker.recordMiss(this.key);
      return null;
    } catch (error) {
      console.error(`Search cache error for key ${this.key}:`, error);
      cacheHitTracker.recordMiss(this.key);
      return null;
    }
  }

  async setResults(results: any[], ttl: number = CacheTTL.SEARCH): Promise<boolean> {
    try {
      const entry: CacheEntry<any[]> = {
        data: results,
        timestamp: Date.now(),
        ttl,
      };

      return await cache.set(this.key, entry, ttl);
    } catch (error) {
      console.error(`Search cache set error for key ${this.key}:`, error);
      return false;
    }
  }
}

/**
 * Analytics Cache Strategy with auto-refresh
 */
export class AnalyticsCacheStrategy extends CacheStrategy<any> {
  async getOrRefresh(computeFn: () => Promise<any>, refreshThreshold: number = 300): Promise<any> {
    try {
      const entry = await cache.get<CacheEntry<any>>(this.key);

      if (entry) {
        const now = Date.now();
        const age = (now - entry.timestamp) / 1000; // Age in seconds

        // If data is fresh, return it
        if (age < refreshThreshold) {
          cacheHitTracker.recordHit(this.key);
          return entry.data;
        }

        // Data is stale, return it but trigger background refresh
        console.log(`🔄 Analytics cache stale, triggering refresh: ${this.key}`);
        this.backgroundRefresh(computeFn, entry.ttl).catch(console.error);

        cacheHitTracker.recordHit(this.key);
        return entry.data;
      }

      // No cache entry, compute and cache
      cacheHitTracker.recordMiss(this.key);
      const data = await computeFn();
      await this.set(data, CacheTTL.ANALYTICS);
      return data;
    } catch (error) {
      console.error(`Analytics cache error for key ${this.key}:`, error);
      cacheHitTracker.recordMiss(this.key);
      return await computeFn();
    }
  }

  private async backgroundRefresh(computeFn: () => Promise<any>, ttl: number): Promise<void> {
    try {
      const data = await computeFn();
      await this.set(data, ttl);
      console.log(`✅ Background refresh complete for: ${this.key}`);
    } catch (error) {
      console.error(`Background refresh failed for ${this.key}:`, error);
    }
  }
}

/**
 * Hierarchical Cache Strategy (L1 in-memory, L2 Redis)
 */
export class HierarchicalCacheStrategy<T> {
  private key: string;
  private l1Cache: Map<string, { data: T; timestamp: number }>;
  private l1TTL: number;
  private l2TTL: number;

  constructor(key: string, l1TTL: number = 60, l2TTL: number = CacheTTL.MEDIUM) {
    this.key = key;
    this.l1Cache = new Map();
    this.l1TTL = l1TTL;
    this.l2TTL = l2TTL;
  }

  async get(): Promise<T | null> {
    const now = Date.now();

    // Check L1 cache first
    const l1Entry = this.l1Cache.get(this.key);
    if (l1Entry && (now - l1Entry.timestamp) < this.l1TTL * 1000) {
      console.log(`✅ L1 cache hit: ${this.key}`);
      cacheHitTracker.recordHit(this.key);
      return l1Entry.data;
    }

    // Check L2 cache (Redis)
    try {
      const l2Entry = await cache.get<CacheEntry<T>>(this.key);
      if (l2Entry) {
        console.log(`✅ L2 cache hit: ${this.key}`);

        // Promote to L1 cache
        this.l1Cache.set(this.key, {
          data: l2Entry.data,
          timestamp: now,
        });

        cacheHitTracker.recordHit(this.key);
        return l2Entry.data;
      }
    } catch (error) {
      console.error(`L2 cache error for ${this.key}:`, error);
    }

    cacheHitTracker.recordMiss(this.key);
    return null;
  }

  async set(data: T): Promise<boolean> {
    const now = Date.now();

    // Set L1 cache
    this.l1Cache.set(this.key, { data, timestamp: now });

    // Set L2 cache
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: now,
        ttl: this.l2TTL,
      };

      return await cache.set(this.key, entry, this.l2TTL);
    } catch (error) {
      console.error(`Cache set error for ${this.key}:`, error);
      return false;
    }
  }

  async invalidate(): Promise<boolean> {
    // Clear L1 cache
    this.l1Cache.delete(this.key);

    // Clear L2 cache
    return await cache.delete(this.key);
  }

  clearL1(): void {
    this.l1Cache.clear();
  }
}

/**
 * Cache Warmer for pre-loading frequently accessed data
 */
export class CacheWarmer {
  private warmingKeys: Set<string> = new Set();

  async warmKey<T>(
    key: string,
    computeFn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    if (this.warmingKeys.has(key)) {
      console.log(`⏳ Cache already warming for key: ${key}`);
      const entry = await cache.get<T>(key);
      return entry || (await computeFn());
    }

    this.warmingKeys.add(key);

    try {
      const data = await computeFn();

      if (ttl !== undefined) {
        await cache.set(key, data, ttl);
      } else {
        await cache.set(key, data, CacheTTL.MEDIUM);
      }

      console.log(`🔥 Cache warmed for key: ${key}`);
      return data;
    } finally {
      this.warmingKeys.delete(key);
    }
  }

  async warmBatch<T>(
    operations: Array<{ key: string; computeFn: () => Promise<T>; ttl?: number }>
  ): Promise<T[]> {
    console.log(`🔥 Warming cache for ${operations.length} keys...`);

    const results = await Promise.all(
      operations.map(({ key, computeFn, ttl }) => this.warmKey(key, computeFn, ttl))
    );

    console.log(`✅ Cache warming complete for ${operations.length} keys`);
    return results;
  }

  isWarming(key: string): boolean {
    return this.warmingKeys.has(key);
  }
}

export const cacheWarmer = new CacheWarmer();
