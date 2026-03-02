import { NextRequest, NextResponse } from 'next/server';
import { analyticsAggregator, AnalyticsSnapshot } from '@/lib/analytics/aggregator';
import { cache } from '@/lib/cache/redis-client';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const investigationId = params.id;

  try {
    const snapshot = await analyticsAggregator.getOrComputeSnapshot(investigationId);

    return NextResponse.json({
      success: true,
      analytics: snapshot,
      cached: snapshot.timestamp.getTime() < Date.now() - 300000,
    });
  } catch (error) {
    console.error('Analytics API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch analytics',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { investigationIds, operation } = await request.json();

    if (operation === 'compute') {
      if (!Array.isArray(investigationIds) || investigationIds.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Invalid investigation IDs' },
          { status: 400 }
        );
      }

      const snapshots = await analyticsAggregator.computeBulkSnapshots(investigationIds);

      return NextResponse.json({
        success: true,
        snapshots,
        timestamp: new Date().toISOString(),
      });
    }

    if (operation === 'invalidate') {
      if (!Array.isArray(investigationIds)) {
        return NextResponse.json(
          { success: false, error: 'Invalid investigation IDs' },
          { status: 400 }
        );
      }

      for (const id of investigationIds) {
        await analyticsAggregator.invalidateSnapshot(id);
      }

      return NextResponse.json({
        success: true,
        message: `Invalidated ${investigationIds.length} analytics snapshots`,
      });
    }

    if (operation === 'warmup') {
      if (!Array.isArray(investigationIds)) {
        return NextResponse.json(
          { success: false, error: 'Invalid investigation IDs' },
          { status: 400 }
        );
      }

      await analyticsAggregator.warmupSnapshots(investigationIds);

      return NextResponse.json({
        success: true,
        message: `Warmed up ${investigationIds.length} analytics snapshots`,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid operation' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Analytics API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Analytics API error',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const daysParam = searchParams.get('days');
  const days = daysParam ? parseInt(daysParam, 10) : 30;

  try {
    const globalAnalytics = await analyticsAggregator.getGlobalAnalytics(days);

    return NextResponse.json({
      success: true,
      analytics: globalAnalytics,
      days,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Global analytics error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch global analytics',
      },
      { status: 500 }
    );
  }
}
