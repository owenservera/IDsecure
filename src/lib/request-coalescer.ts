import { NextResponse } from 'next/server';
import { cache, CacheTTL } from '@/lib/cache/redis-client';

interface CoalescedRequest<T> {
  promise: Promise<T>;
  timestamp: number;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

export class RequestCoalescer {
  private pending: Map<string, CoalescedRequest<any>> = new Map();
  private cacheTimeout: number;

  constructor(cacheTimeout: number = 300000) {
    this.cacheTimeout = cacheTimeout;
  }

  async coalesce<T>(
    key: string,
    fn: () => Promise<T>,
    ttl: number = CacheTTL.API_RESPONSE
  ): Promise<T> {
    const existing = this.pending.get(key);

    if (existing) {
      console.log(`🔄 Coalescing request for key: ${key}`);
      return existing.promise;
    }

    const resolve: any = {};
    const reject: any = {};
    const promise = new Promise<T>((res, rej) => {
      resolve.value = res;
      reject.value = rej;
    });

    const request: CoalescedRequest<T> = {
      promise,
      timestamp: Date.now(),
      resolve: resolve.value,
      reject: reject.value,
    };

    this.pending.set(key, request);

    try {
      const result = await fn();
      resolve.value(result);
    } catch (error) {
      reject.value(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.pending.delete(key);
    }

    return promise;
  }

  hasPending(key: string): boolean {
    return this.pending.has(key);
  }

  getPendingCount(): number {
    return this.pending.size;
  }

  getPendingKeys(): string[] {
    return Array.from(this.pending.keys());
  }

  clearStaleRequests(): number {
    const now = Date.now();
    let cleared = 0;

    for (const [key, request] of this.pending.entries()) {
      if (now - request.timestamp > this.cacheTimeout) {
        this.pending.delete(key);
        cleared++;

        if (request.reject) {
          request.reject(new Error('Request timeout'));
        }
      }
    }

    if (cleared > 0) {
      console.log(`🗑️  Cleared ${cleared} stale coalesced requests`);
    }

    return cleared;
  }

  clearAll(): void {
    const count = this.pending.size;
    this.pending.clear();

    if (count > 0) {
      console.log(`🗑️  Cleared all ${count} coalesced requests`);
    }
  }
}

export const requestCoalescer = new RequestCoalescer();

export function generateCacheKey(
  method: string,
  url: string,
  params: Record<string, unknown> = {},
  headers: Record<string, string> = {}
): string {
  const normalizedParams = Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => [k.toLowerCase(), String(v)])
    .sort(([a], [b]) => a.localeCompare(b));

  const normalizedHeaders = Object.entries(headers)
    .filter(([k, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => [k.toLowerCase(), String(v)])
    .sort(([a], [b]) => a.localeCompare(b));

  const parts = [
    method,
    url,
    ...normalizedParams,
    ...normalizedHeaders,
  ];

  return `coalesce:${parts.join(':')}`;
}

export async function withRequestCoalescing<T>(
  method: string,
  url: string,
  fn: () => Promise<T>,
  options: {
    params?: Record<string, unknown>;
    headers?: Record<string, string>;
    ttl?: number;
    skipCache?: boolean;
  } = {}
): Promise<{ result: T; cached: boolean }> {
  const { params, headers, ttl, skipCache } = options;

  const cacheKey = skipCache
    ? null
    : generateCacheKey(method, url, params || {}, headers || {});

  if (cacheKey) {
    const cached = await cache.get<T>(cacheKey);

    if (cached) {
      console.log(`✅ Cache hit: ${cacheKey}`);
      return { result: cached, cached: true };
    }
  }

  const coalesceKey = cacheKey || generateCacheKey(method, url, params || {}, headers || {});

  const result = await requestCoalescer.coalesce(coalesceKey, fn, ttl || CacheTTL.API_RESPONSE);

  if (cacheKey && !skipCache) {
    await cache.set(cacheKey, result, ttl || CacheTTL.API_RESPONSE);
  }

  return { result, cached: false };
}

setInterval(() => {
  requestCoalescer.clearStaleRequests();
}, 60000);

if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    requestCoalescer.clearStaleRequests();
  }, 30000);
}
