import { SearchResult } from '@/lib/types';

/**
 * Cache Key Generators
 * Type-safe cache key generation with consistent naming
 */
export const CacheKeys = {
  /**
   * Search result cache key
   * @param params Search parameters
   * @returns Formatted cache key
   */
  search: (params: Record<string, unknown>): string => {
    const normalized = normalizeSearchParams(params);
    const paramsString = new URLSearchParams(
      Object.fromEntries(normalized) as any
    ).toString();
    const encoded = Buffer.from(paramsString).toString('base64');
    return `search:${encoded}`;
  },

  /**
   * Investigation cache key
   * @param id Investigation ID
   */
  investigation: (id: string): string => `investigation:${id}`,

  /**
   * Analytics snapshot cache key
   * @param investigationId Investigation ID
   */
  analytics: (investigationId: string): string => `analytics:${investigationId}`,

  /**
   * Risk assessment cache key
   * @param investigationId Investigation ID
   */
  riskAssessment: (investigationId: string): string => `risk:${investigationId}`,

  /**
   * Breach data cache key
   * @param params Search parameters (email, phone, username)
   */
  breachData: (params: { email?: string; phone?: string; username?: string }): string => {
    const normalized = Object.entries(params)
      .filter(([_, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => [k.toLowerCase(), String(v)])
      .sort(([a], [b]) => a.localeCompare(b));
    const encoded = Buffer.from(JSON.stringify(normalized)).toString('base64');
    return `breach:${encoded}`;
  },

  /**
   * Stylometry analysis cache key
   * @param profileIds Array of profile IDs
   */
  stylometry: (profileIds: string[]): string => {
    const sortedIds = [...profileIds].sort();
    const encoded = Buffer.from(JSON.stringify(sortedIds)).toString('base64');
    return `stylometry:${encoded}`;
  },

  /**
   * Image forensics cache key
   * @param imageHash SHA256 hash of the image
   */
  imageForensics: (imageHash: string): string => `forensics:${imageHash}`,

  /**
   * Entity resolution cache key
   * @param investigationId Investigation ID
   */
  entityResolution: (investigationId: string): string => `entity:${investigationId}`,

  /**
   * Dark web report cache key
   * @param params Search parameters
   */
  darkWeb: (params: { email?: string; phone?: string; username?: string }): string => {
    const normalized = Object.entries(params)
      .filter(([_, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => [k.toLowerCase(), String(v)])
      .sort(([a], [b]) => a.localeCompare(b));
    const encoded = Buffer.from(JSON.stringify(normalized)).toString('base64');
    return `darkweb:${encoded}`;
  },

  /**
   * Report cache key
   * @param investigationId Investigation ID
   * @param format Report format (pdf, markdown)
   */
  report: (investigationId: string, format: 'pdf' | 'markdown'): string =>
    `report:${investigationId}:${format}`,

  /**
   * Investigation history cache key
   * @param userId User ID
   */
  investigationHistory: (userId: string): string => `history:${userId}`,

  /**
   * Platform search results cache key
   * @param investigationId Investigation ID
   * @param platform Platform name
   */
  platformResults: (investigationId: string, platform: string): string =>
    `platform:${investigationId}:${platform.toLowerCase()}`,

  /**
   * User session cache key
   * @param sessionId Session ID
   */
  session: (sessionId: string): string => `session:${sessionId}`,

  /**
   * API response cache key
   * @param endpoint API endpoint
   * @param params Request parameters
   */
  apiResponse: (endpoint: string, params: Record<string, unknown> = {}): string => {
    const paramsString = Object.keys(params).length > 0
      ? `:${Buffer.from(JSON.stringify(params)).toString('base64')}`
      : '';
    return `api:${endpoint}${paramsString}`;
  },
};

/**
 * Cache Key Patterns for Bulk Operations
 */
export const CachePatterns = {
  /**
   * All keys for an investigation
   */
  investigation: (investigationId: string): string =>
    `*:${investigationId}:*`,

  /**
   * All search keys
   */
  search: 'search:*',

  /**
   * All analytics keys
   */
  analytics: 'analytics:*',

  /**
   * All cache keys
   */
  all: '*',
};

/**
 * Normalize search parameters for consistent caching
 */
function normalizeSearchParams(params: Record<string, unknown>): [string, string][] {
  return Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => [k.toLowerCase(), normalizeValue(v)])
    .sort(([a], [b]) => a.localeCompare(b));
}

/**
 * Normalize a parameter value
 */
function normalizeValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim().toLowerCase();
  }
  if (Array.isArray(value)) {
    return value
      .map(v => normalizeValue(v))
      .sort()
      .join(',');
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value)
      .map(([k, v]) => `${k}:${normalizeValue(v)}`)
      .sort()
      .join(';');
  }
  return String(value);
}

/**
 * Cache Invalidation Strategies
 */
export const CacheInvalidation = {
  /**
   * Invalidate all cache related to an investigation
   */
  invalidateInvestigation: async (investigationId: string): Promise<void> => {
    const { cache } = await import('./redis-client');
    const pattern = CachePatterns.investigation(investigationId);
    await cache.invalidatePattern(pattern);
  },

  /**
   * Invalidate search cache for specific parameters
   */
  invalidateSearch: async (params: Record<string, unknown>): Promise<void> => {
    const { cache } = await import('./redis-client');
    const key = CacheKeys.search(params);
    await cache.delete(key);
  },

  /**
   * Invalidate analytics cache
   */
  invalidateAnalytics: async (investigationId: string): Promise<void> => {
    const { cache } = await import('./redis-client');
    const key = CacheKeys.analytics(investigationId);
    await cache.delete(key);
  },

  /**
   * Invalidate risk assessment cache
   */
  invalidateRiskAssessment: async (investigationId: string): Promise<void> => {
    const { cache } = await import('./redis-client');
    const key = CacheKeys.riskAssessment(investigationId);
    await cache.delete(key);
  },

  /**
   * Warm up cache for frequently accessed data
   */
  warmup: async (investigationId: string): Promise<void> => {
    const { cache } = await import('./redis-client');

    // Pre-load analytics
    const analyticsKey = CacheKeys.analytics(investigationId);
    const analytics = await cache.get(analyticsKey);
    if (!analytics) {
      // Trigger analytics computation
      console.log(`🔥 Warming up cache for investigation: ${investigationId}`);
    }
  },
};

/**
 * Cache Hit Rate Tracker
 */
export class CacheHitTracker {
  private static instance: CacheHitTracker;
  private hits: Map<string, number> = new Map();
  private misses: Map<string, number> = new Map();

  private constructor() {}

  static getInstance(): CacheHitTracker {
    if (!CacheHitTracker.instance) {
      CacheHitTracker.instance = new CacheHitTracker();
    }
    return CacheHitTracker.instance;
  }

  recordHit(key: string): void {
    this.hits.set(key, (this.hits.get(key) || 0) + 1);
  }

  recordMiss(key: string): void {
    this.misses.set(key, (this.misses.get(key) || 0) + 1);
  }

  getHitRate(): number {
    const totalHits = Array.from(this.hits.values()).reduce((sum, count) => sum + count, 0);
    const totalMisses = Array.from(this.misses.values()).reduce((sum, count) => sum + count, 0);
    const total = totalHits + totalMisses;

    return total > 0 ? (totalHits / total) * 100 : 0;
  }

  getStats(): { hits: number; misses: number; hitRate: number } {
    const hits = Array.from(this.hits.values()).reduce((sum, count) => sum + count, 0);
    const misses = Array.from(this.misses.values()).reduce((sum, count) => sum + count, 0);

    return {
      hits,
      misses,
      hitRate: this.getHitRate(),
    };
  }

  reset(): void {
    this.hits.clear();
    this.misses.clear();
  }
}

export const cacheHitTracker = CacheHitTracker.getInstance();
