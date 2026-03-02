import { NextResponse } from 'next/server';
import { cache, CacheTTL } from '@/lib/cache/redis-client';
import { dbRead, dbWrite, getConnectionStats } from '@/lib/db-pool';
import { getAllQueueStats } from '@/lib/queue/job-queue';
import ZAI from 'z-ai-web-dev-sdk';

interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: {
      status: 'ok' | 'error';
      latency?: number;
      details?: any;
    };
    redis: {
      status: 'ok' | 'error';
      latency?: number;
      stats?: any;
    };
    external_apis: {
      zai: {
        status: 'ok' | 'error';
        latency?: number;
      };
    };
    queues: {
      search?: any;
      analysis?: any;
      reports?: any;
      maintenance?: any;
    };
    disk: {
      total: number;
      free: number;
      usedPercent: number;
    };
    memory: {
      heapUsed: number;
      heapTotal: number;
      external: number;
      rss: number;
    };
  };
}

const startTime = Date.now();

export async function GET(request: NextRequest) {
  const checks: HealthCheckResponse['checks'] = {
    database: { status: 'error' },
    redis: { status: 'error' },
    external_apis: {
      zai: { status: 'error' },
    },
    queues: {},
    disk: { total: 0, free: 0, usedPercent: 0 },
    memory: { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 },
  };

  let overallStatus: 'healthy' = 'healthy';

  try {
    const dbStart = Date.now();
    await dbRead.$queryRaw`SELECT 1`;
    const dbStats = await getConnectionStats();
    const dbLatency = Date.now() - dbStart;

    checks.database = {
      status: 'ok',
      latency: dbLatency,
      details: dbStats,
    };
  } catch (error) {
    console.error('Database health check failed:', error);
    checks.database.status = 'error';
    overallStatus = 'degraded';
  }

  try {
    const redisStart = Date.now();
    await cache.ping();
    const redisStats = await cache.getStats();
    const redisLatency = Date.now() - redisStart;

    checks.redis = {
      status: cache.isRedisReady() ? 'ok' : 'error',
      latency: redisLatency,
      stats: redisStats,
    };

    if (!cache.isRedisReady()) {
      overallStatus = 'degraded';
    }
  } catch (error) {
    console.error('Redis health check failed:', error);
    checks.redis.status = 'error';
    overallStatus = 'degraded';
  }

  try {
    const zaiStart = Date.now();
    const zai = await ZAI.create();
    await zai.chat.completions.create({
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 1,
    });
    const zaiLatency = Date.now() - zaiStart;

    checks.external_apis.zai = {
      status: 'ok',
      latency: zaiLatency,
    };
  } catch (error) {
    console.error('ZAI health check failed:', error);
    checks.external_apis.zai.status = 'error';
  }

  if (checks.external_apis.zai.status === 'error') {
    overallStatus = 'degraded';
  }

  try {
    const queueStats = await getAllQueueStats();
    checks.queues = queueStats;

    const { waiting, active, failed } = queueStats.search;

    if (failed > 10) {
      overallStatus = 'degraded';
    }

    if (waiting > 100) {
      overallStatus = 'degraded';
    }
  } catch (error) {
    console.error('Queue health check failed:', error);
    overallStatus = 'degraded';
  }

  const memoryUsage = process.memoryUsage();
  checks.memory = {
    heapUsed: memoryUsage.heapUsed,
    heapTotal: memoryUsage.heapTotal,
    external: memoryUsage.external,
    rss: memoryUsage.rss,
  };

  const memoryPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
  if (memoryPercent > 90) {
    overallStatus = 'degraded';
  }

  const uptime = Date.now() - startTime;
  const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 503 : 503;

  const response: HealthCheckResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime,
    checks,
  };

  return NextResponse.json(response, { status: statusCode });
}

export async function HEAD(request: NextRequest) {
  return GET(request);
}
