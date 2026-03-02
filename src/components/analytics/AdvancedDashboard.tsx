'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from '@/components/ui/chart';
import { TrendingUp, TrendingDown, RefreshCw, Activity, Search, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface InvestigationAnalytics {
  investigationId: string;
  totalInvestigations: number;
  totalSearches: number;
  totalResults: number;
  averageConfidence: number;
  platformsCount: Record<string, number>;
  riskDistribution: Record<string, number>;
  temporalData: Array<{ date: string; searches: number; results: number }>;
  successRate: number;
  avgSearchDuration: number;
}

interface AdvancedDashboardProps {
  investigationId?: string;
  globalView?: boolean;
  refreshInterval?: number;
}

export default function AdvancedDashboard({
  investigationId,
  globalView = false,
  refreshInterval = 60000,
}: AdvancedDashboardProps) {
  const [analytics, setAnalytics] = useState<InvestigationAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const endpoint = globalView ? '/api/analytics' : `/api/analytics/investigation`;
      const params = new URLSearchParams();

      if (investigationId) {
        params.append('investigationId', investigationId);
      }
      params.append('period', selectedPeriod);

      const response = await fetch(`${endpoint}?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: InvestigationAnalytics = await response.json();
      setAnalytics(data);
      setLastUpdated(new Date());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch analytics';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [investigationId, globalView, selectedPeriod]);

  useEffect(() => {
    fetchAnalytics();

    if (refreshInterval > 0) {
      const interval = setInterval(fetchAnalytics, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchAnalytics, refreshInterval]);

  if (isLoading && !analytics) {
    return <DashboardSkeleton />;
  }

  if (error && !analytics) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-[400px] space-y-4">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <div className="text-center">
            <p className="font-semibold">Failed to load analytics</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
          <Button onClick={fetchAnalytics} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            {globalView ? 'Global view' : `Investigation: ${investigationId}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button onClick={fetchAnalytics} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2">
        <Badge
          variant={selectedPeriod === '7d' ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => setSelectedPeriod('7d')}
        >
          7 Days
        </Badge>
        <Badge
          variant={selectedPeriod === '30d' ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => setSelectedPeriod('30d')}
        >
          30 Days
        </Badge>
        <Badge
          variant={selectedPeriod === '90d' ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => setSelectedPeriod('90d')}
        >
          90 Days
        </Badge>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Investigations"
          value={analytics?.totalInvestigations || 0}
          icon={<Activity className="h-4 w-4" />}
          trend={globalView ? undefined : undefined}
        />
        <MetricCard
          title="Total Searches"
          value={analytics?.totalSearches || 0}
          icon={<Search className="h-4 w-4" />}
          trend={globalView ? 'up' : undefined}
          trendValue={12}
        />
        <MetricCard
          title="Total Results"
          value={analytics?.totalResults || 0}
          icon={<CheckCircle2 className="h-4 w-4" />}
          trend={globalView ? 'up' : undefined}
          trendValue={8}
        />
        <MetricCard
          title="Avg Confidence"
          value={`${analytics?.averageConfidence.toFixed(1) || 0}%`}
          icon={<TrendingUp className="h-4 w-4" />}
          trend={globalView ? 'up' : undefined}
          trendValue={5}
        />
      </div>

      {/* Charts */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="platforms">Platforms</TabsTrigger>
          <TabsTrigger value="risk">Risk Analysis</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Search Volume Over Time</CardTitle>
                <CardDescription>Number of searches and results per day</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics?.temporalData || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      labelFormatter={(value) => new Date(value).toLocaleDateString()}
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="searches"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      name="Searches"
                    />
                    <Line
                      type="monotone"
                      dataKey="results"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      name="Results"
                      opacity={0.6}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Key performance indicators</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Success Rate</span>
                    <span className="text-2xl font-bold">{analytics?.successRate.toFixed(1)}%</span>
                  </div>
                  <Progress value={analytics?.successRate || 0} />
                </div>

                <Separator />

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Average Search Duration</span>
                    <span className="text-2xl font-bold">{analytics?.avgSearchDuration.toFixed(2)}s</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <TrendingDown className="h-4 w-4 text-green-500" />
                    <span>12% faster than last period</span>
                  </div>
                </div>

                <Separator />

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Results Per Search</span>
                    <span className="text-2xl font-bold">
                      {analytics?.totalSearches ? (analytics.totalResults / analytics.totalSearches).toFixed(1) : 0}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                    <span>8% increase</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="platforms" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Platform Distribution</CardTitle>
                <CardDescription>Results by platform</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={Object.entries(analytics?.platformsCount || {}).map(([name, value]) => ({ name, value }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {Object.entries(analytics?.platformsCount || {}).map(([name], index) => (
                        <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${index + 1}))`} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Platform Breakdown</CardTitle>
                <CardDescription>Detailed platform statistics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(analytics?.platformsCount || {}).map(([platform, count], index) => (
                    <div key={platform} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: `hsl(var(--chart-${index + 1}))` }}
                        />
                        <span className="text-sm font-medium">{platform}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">{count}</div>
                        <div className="text-xs text-muted-foreground">
                          {((count / (analytics?.totalResults || 1)) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="risk" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Risk Distribution</CardTitle>
              <CardDescription>Investigation results by risk level</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={Object.entries(analytics?.riskDistribution || {}).map(([name, value]) => ({ name, value }))}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={100} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Timeline</CardTitle>
              <CardDescription>Search and result trends over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={analytics?.temporalData || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend />
                  <Bar dataKey="searches" fill="hsl(var(--primary))" opacity={0.3} name="Searches" />
                  <Line
                    type="monotone"
                    dataKey="results"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    name="Results"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
  trend,
  trendValue,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: 'up' | 'down';
  trendValue?: number;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {trend && trendValue !== undefined && (
              <div className={`flex items-center gap-1 mt-1 text-sm ${trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                {trend === 'up' ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                <span>{trendValue}% from last period</span>
              </div>
            )}
          </div>
          <div className="text-muted-foreground">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-8 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="h-[400px]">
          <Skeleton className="h-full w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
