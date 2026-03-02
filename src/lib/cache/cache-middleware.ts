import { NextResponse } from 'next/server';
import { cache } from './redis-client';
import { CacheKeys, CacheTTL } from './cache-keys';

/**
 * Cache Middleware Configuration
 */
interface CacheMiddlewareConfig {
  enabled?: boolean;
  ttl?: number;
  varyHeaders?: string[];
  skipCache?: (request: Request) => boolean;
  keyGenerator?: (request: Request) => string;
}

const defaultConfig: CacheMiddlewareConfig = {
  enabled: process.env.NODE_ENV === 'production',
  ttl: CacheTTL.API_RESPONSE,
  varyHeaders: ['authorization', 'cookie'],
};

/**
 * Create cache middleware
 */
export function createCacheMiddleware(config: CacheMiddlewareConfig = {}) {
  const middlewareConfig = { ...defaultConfig, ...config };

  return async function cacheMiddleware(
    request: Request,
    next: () => Promise<Response>
  ): Promise<Response> {
    // Skip cache if disabled
    if (!middlewareConfig.enabled) {
      return next();
    }

    // Skip cache if condition met
    if (middlewareConfig.skipCache && middlewareConfig.skipCache(request)) {
      return next();
    }

    // Skip cache for non-GET requests
    if (request.method !== 'GET') {
      return next();
    }

    // Generate cache key
    const cacheKey = middlewareConfig.keyGenerator
      ? middlewareConfig.keyGenerator(request)
      : generateCacheKey(request, middlewareConfig.varyHeaders || []);

    try {
      // Try to get cached response
      const cached = await cache.get<CachedResponse>(cacheKey);

      if (cached) {
        console.log(`✅ Cache hit: ${cacheKey}`);
        return NextResponse.json(cached.data, {
          status: cached.status,
          headers: {
            ...cached.headers,
            'X-Cache': 'HIT',
            'X-Cache-Key': cacheKey,
          },
        });
      }

      console.log(`❌ Cache miss: ${cacheKey}`);

      // Execute request
      const response = await next();

      // Only cache successful responses
      if (response.status === 200) {
        const clonedResponse = response.clone();
        const data = await clonedResponse.json();

        const cachedResponse: CachedResponse = {
          data,
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
        };

        // Cache the response
        await cache.set(cacheKey, cachedResponse, middlewareConfig.ttl || CacheTTL.API_RESPONSE);
      }

      return response;
    } catch (error) {
      console.error('Cache middleware error:', error);
      // Continue without cache on error
      return next();
    }
  };
}

/**
 * Cached response structure
 */
interface CachedResponse {
  data: unknown;
  status: number;
  headers: Record<string, string>;
}

/**
 * Generate cache key from request
 */
function generateCacheKey(request: Request, varyHeaders: string[]): string {
  const url = new URL(request.url);
  const method = request.method;

  // Include vary headers in key
  const varyValues: string[] = [];

  for (const header of varyHeaders) {
    const value = request.headers.get(header);
    if (value) {
      varyValues.push(`${header}:${value}`);
    }
  }

  const keyParts = [
    'api',
    method,
    url.pathname,
    url.search,
    ...varyValues,
  ];

  return keyParts.join(':').replace(/[^a-zA-Z0-9:]/g, '_');
}

/**
 * Invalidate cache on mutation
 */
export async function invalidateCacheOnMutation(
  request: Request,
  patterns: string[]
): Promise<void> {
  // Only invalidate on mutations
  if (request.method === 'GET' || request.method === 'HEAD') {
    return;
  }

  console.log(`🗑️  Invalidating cache patterns:`, patterns);

  for (const pattern of patterns) {
    await cache.invalidatePattern(pattern);
  }
}

/**
 * Cache-Control header generator
 */
export function getCacheControlHeaders(
  maxAge: number,
  mustRevalidate: boolean = false
): Record<string, string> {
  const directives = [`max-age=${maxAge}`];

  if (mustRevalidate) {
    directives.push('must-revalidate');
  }

  return {
    'Cache-Control': directives.join(', '),
  };
}

/**
 * Cache tags for bulk invalidation
 */
export function getCacheTags(...tags: string[]): string {
  return tags.join(',');
}
