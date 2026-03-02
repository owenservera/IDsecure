/**
 * Health Check API Endpoint
 * Provides comprehensive health status for monitoring
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cacheService } from '@/services/cache/cache.service';
import { rateLimitService } from '@/services/rate-limit/rate-limit.service';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    database: { status: 'up' | 'down'; latency?: number };
    cache: { status: 'up' | 'down'; latency?: number };
    rateLimit: { status: 'up' | 'down'; latency?: number };
  };
  metrics?: {
    investigations?: number;
    cacheHitRate?: number;
  };
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const healthStatus: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    services: {
      database: { status: 'down' },
      cache: { status: 'down' },
      rateLimit: { status: 'down' },
    },
  };

  let issues = 0;

  // Check database
  try {
    const dbStart = Date.now();
    await db.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - dbStart;
    healthStatus.services.database = { status: 'up', latency: dbLatency };
  } catch (error) {
    healthStatus.services.database = { status: 'down' };
    issues++;
  }

  // Check cache
  try {
    const cacheStart = Date.now();
    const cacheHealthy = await cacheService.healthCheck();
    const cacheLatency = Date.now() - cacheStart;
    healthStatus.services.cache = {
      status: cacheHealthy ? 'up' : 'down',
      latency: cacheHealthy ? cacheLatency : undefined,
    };
    if (!cacheHealthy) issues++;
  } catch (error) {
    healthStatus.services.cache = { status: 'down' };
    issues++;
  }

  // Check rate limiting
  try {
    const rateLimitStart = Date.now();
    const rateLimitHealthy = await rateLimitService.healthCheck();
    const rateLimitLatency = Date.now() - rateLimitStart;
    healthStatus.services.rateLimit = {
      status: rateLimitHealthy ? 'up' : 'down',
      latency: rateLimitHealthy ? rateLimitLatency : undefined,
    };
    if (!rateLimitHealthy) issues++;
  } catch (error) {
    healthStatus.services.rateLimit = { status: 'down' };
    issues++;
  }

  // Determine overall status
  if (issues === 0) {
    healthStatus.status = 'healthy';
  } else if (issues <= 1) {
    healthStatus.status = 'degraded';
  } else {
    healthStatus.status = 'unhealthy';
  }

  // Add metrics if healthy
  if (healthStatus.status !== 'unhealthy') {
    try {
      const [investigations] = await Promise.all([
        db.investigation.count(),
      ]);
      
      healthStatus.metrics = {
        investigations,
      };
    } catch (error) {
      // Metrics are optional, don't fail health check
    }
  }

  const statusCode = healthStatus.status === 'healthy' ? 200 : 
                     healthStatus.status === 'degraded' ? 207 : 503;

  return NextResponse.json(healthStatus, { status: statusCode });
}

/**
 * HEAD endpoint for lightweight health checks
 */
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
