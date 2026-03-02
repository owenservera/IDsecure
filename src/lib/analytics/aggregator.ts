import { db, dbRead, dbWrite } from '@/lib/db-pool';
import { cache, CacheTTL } from '@/lib/cache/redis-client';
import { CacheKeys } from '@/lib/cache/cache-keys';

export interface AnalyticsSnapshot {
  investigationId: string;
  timestamp: Date;
  totalProfiles: number;
  highConfidenceProfiles: number;
  platformDistribution: Record<string, number>;
  confidenceDistribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  averageConfidence: number;
  topLocations: string[];
  topCompanies: string[];
  riskLevel: string;
  riskScore: number;
  latestResult?: Date;
  breachCount: number;
}

export class AnalyticsAggregator {
  async computeSnapshot(investigationId: string): Promise<AnalyticsSnapshot> {
    const startTime = Date.now();
    console.log(`📊 Computing analytics for: ${investigationId}`);

    try {
      const results = await dbRead.searchResult.findMany({
        where: { investigationId },
        select: {
          confidence: true,
          platform: true,
          location: true,
          company: true,
          profession: true,
          stage: true,
          createdAt: true,
        },
      });

      const investigation = await dbRead.investigation.findUnique({
        where: { id: investigationId },
        include: {
          riskAssessment: true,
          breaches: true,
        },
      });

      if (!investigation) {
        throw new Error(`Investigation not found: ${investigationId}`);
      }

      const totalProfiles = results.length;
      const highConfidenceProfiles = results.filter(r => r.confidence >= 80).length;

      const platformDistribution = results.reduce((acc, r) => {
        acc[r.platform] = (acc[r.platform] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const confidenceDistribution = {
        critical: results.filter(r => r.confidence >= 90).length,
        high: results.filter(r => r.confidence >= 80 && r.confidence < 90).length,
        medium: results.filter(r => r.confidence >= 60 && r.confidence < 80).length,
        low: results.filter(r => r.confidence < 60).length,
      };

      const averageConfidence = totalProfiles > 0
        ? results.reduce((sum, r) => sum + r.confidence, 0) / totalProfiles
        : 0;

      const locationCounts = results.reduce((acc, r) => {
        if (r.location) {
          acc[r.location] = (acc[r.location] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      const topLocations = Object.entries(locationCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([location]) => location);

      const companyCounts = results.reduce((acc, r) => {
        if (r.company) {
          acc[r.company] = (acc[r.company] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      const topCompanies = Object.entries(companyCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([company]) => company);

      const riskLevel = investigation.riskAssessment?.riskLevel || 'low';
      const riskScore = investigation.riskAssessment?.overallScore || 0;
      const breachCount = investigation.breaches?.length || 0;

      const latestResult = results.length > 0
        ? results.reduce((latest, r) =>
            r.createdAt > latest.createdAt ? r.createdAt : latest.createdAt
          , results[0])
        : undefined;

      const snapshot: AnalyticsSnapshot = {
        investigationId,
        timestamp: new Date(),
        totalProfiles,
        highConfidenceProfiles,
        platformDistribution,
        confidenceDistribution,
        averageConfidence,
        topLocations,
        topCompanies,
        riskLevel,
        riskScore,
        breachCount,
        latestResult,
      };

      const computeTime = Date.now() - startTime;
      console.log(`✅ Analytics computed in ${computeTime}ms for: ${investigationId}`);

      await this.cacheSnapshot(investigationId, snapshot);

      return snapshot;
    } catch (error) {
      console.error(`Analytics computation error for ${investigationId}:`, error);
      throw error;
    }
  }

  async computeBulkSnapshots(investigationIds: string[]): Promise<AnalyticsSnapshot[]> {
    console.log(`📊 Computing analytics for ${investigationIds.length} investigations`);

    const snapshots: AnalyticsSnapshot[] = [];

    for (const investigationId of investigationIds) {
      try {
        const snapshot = await this.computeSnapshot(investigationId);
        snapshots.push(snapshot);
      } catch (error) {
        console.error(`Failed to compute analytics for ${investigationId}:`, error);
      }
    }

    return snapshots;
  }

  private async cacheSnapshot(investigationId: string, snapshot: AnalyticsSnapshot): Promise<void> {
    const cacheKey = CacheKeys.analytics(investigationId);

    try {
      await cache.set(cacheKey, snapshot, CacheTTL.ANALYTICS);
      console.log(`💾 Analytics cached for: ${investigationId}`);
    } catch (error) {
      console.error(`Failed to cache analytics for ${investigationId}:`, error);
    }
  }

  async getCachedSnapshot(investigationId: string): Promise<AnalyticsSnapshot | null> {
    const cacheKey = CacheKeys.analytics(investigationId);

    try {
      const cached = await cache.get<AnalyticsSnapshot>(cacheKey);

      if (cached) {
        const ageSeconds = (Date.now() - cached.timestamp.getTime()) / 1000;

        if (ageSeconds < 300) {
          console.log(`✅ Cache hit for analytics: ${investigationId}`);
          return cached;
        }

        console.log(`⚠️  Cache stale for analytics: ${investigationId} (${ageSeconds}s old)`);
      }
    } catch (error) {
      console.error(`Failed to retrieve cached analytics for ${investigationId}:`, error);
    }

    return null;
  }

  async invalidateSnapshot(investigationId: string): Promise<void> {
    const cacheKey = CacheKeys.analytics(investigationId);

    try {
      await cache.delete(cacheKey);
      console.log(`🗑️  Analytics cache invalidated for: ${investigationId}`);
    } catch (error) {
      console.error(`Failed to invalidate analytics cache for ${investigationId}:`, error);
    }
  }

  async getOrComputeSnapshot(investigationId: string): Promise<AnalyticsSnapshot> {
    const cached = await this.getCachedSnapshot(investigationId);

    if (cached) {
      return cached;
    }

    console.log(`🔄 Computing fresh analytics for: ${investigationId}`);
    return await this.computeSnapshot(investigationId);
  }

  async warmupSnapshots(investigationIds: string[]): Promise<void> {
    console.log(`🔥 Warming up ${investigationIds.length} analytics caches...`);

    for (const investigationId of investigationIds) {
      try {
        await this.getOrComputeSnapshot(investigationId);
      } catch (error) {
        console.error(`Failed to warmup analytics for ${investigationId}:`, error);
      }
    }

    console.log(`✅ Analytics warmup complete for ${investigationIds.length} investigations`);
  }

  async getGlobalAnalytics(days: number = 30): Promise<{
    totalInvestigations: number;
    completedInvestigations: number;
    avgProfilesPerInvestigation: number;
    totalProfiles: number;
    avgConfidence: number;
    riskDistribution: Record<string, number>;
    topPlatforms: Record<string, number>;
    breachIncidents: number;
  }> {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    const [investigations, resultStats, breachStats] = await Promise.all([
      dbRead.investigation.findMany({
        where: {
          createdAt: { gte: sinceDate },
        },
        select: {
          id: true,
          status: true,
          _count: {
            select: { results: true },
          },
        },
      }),
      dbRead.$queryRaw`
        SELECT
          AVG(confidence) as avg_confidence,
          COUNT(*) as total_profiles
        FROM search_result
        WHERE created_at >= $1
      `,
      [sinceDate.toISOString()],
    ),
      dbRead.breachIncident.count({
        where: {
          createdAt: { gte: sinceDate },
        },
      }),
    ]);

    const totalInvestigations = investigations.length;
    const completedInvestigations = investigations.filter((inv: any) => inv.status === 'completed').length;
    const avgProfilesPerInvestigation = resultStats[0]?.avg_confidence || 0;
    const totalProfiles = Number(resultStats[0]?.total_profiles || 0);

    const platformQuery = await dbRead.$queryRaw`
      SELECT platform, COUNT(*) as count
      FROM search_result sr
      JOIN investigation i ON sr.investigationId = i.id
      WHERE i.createdAt >= $1
      GROUP BY platform
    `,
      [sinceDate.toISOString()],
    );

    const topPlatforms: Record<string, number> = {};
    for (const row of platformQuery as any[]) {
      topPlatforms[row.platform] = row.count;
    }

    const riskQuery = await dbRead.investigation.findMany({
      where: {
        createdAt: { gte: sinceDate },
      },
      include: {
        riskAssessment: true,
      },
      select: {
        riskAssessment: {
          select: {
            riskLevel: true,
          },
        },
      },
    });

    const riskDistribution: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    for (const investigation of riskQuery as any[]) {
      if (investigation.riskAssessment) {
        riskDistribution[investigation.riskAssessment.riskLevel]++;
      }
    }

    return {
      totalInvestigations,
      completedInvestigations,
      avgProfilesPerInvestigation,
      totalProfiles,
      avgConfidence: avgProfilesPerInvestigation,
      riskDistribution,
      topPlatforms,
      breachIncidents,
    };
  }
}

export const analyticsAggregator = new AnalyticsAggregator();
