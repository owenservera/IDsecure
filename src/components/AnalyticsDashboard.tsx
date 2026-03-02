'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BarChart3, Activity, PieChart, Brain, TrendingUp, MapPin } from 'lucide-react';
import { SearchResult, StatisticalAnalysis } from '@/lib/types';

interface AnalyticsDashboardProps {
  results: SearchResult[];
  analysis: StatisticalAnalysis | null;
}

export function AnalyticsDashboard({ results, analysis }: AnalyticsDashboardProps) {
  if (results.length === 0) {
    return (
      <Card className="h-64 flex items-center justify-center text-muted-foreground border-dashed">
        <div className="text-center">
          <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-20" />
          <p>Run a search to generate analytics</p>
        </div>
      </Card>
    );
  }

  const platformCounts = results.reduce((acc, r) => {
    acc[r.platform] = (acc[r.platform] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30">
          <CardContent className="p-4">
            <p className="text-3xl font-bold text-violet-600">{results.length}</p>
            <p className="text-xs text-muted-foreground">Total Profiles</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30">
          <CardContent className="p-4">
            <p className="text-3xl font-bold text-green-600">{results.filter(r => r.confidence >= 80).length}</p>
            <p className="text-xs text-muted-foreground">High Confidence</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30">
          <CardContent className="p-4">
            <p className="text-3xl font-bold text-blue-600">{new Set(results.map(r => r.platform)).size}</p>
            <p className="text-xs text-muted-foreground">Platforms</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30">
          <CardContent className="p-4">
            <p className="text-3xl font-bold text-amber-600">{analysis?.overallConfidence || 0}%</p>
            <p className="text-xs text-muted-foreground">Avg Confidence</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <PieChart className="h-4 w-4" /> Platform Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-2">
            {Object.entries(platformCounts).sort((a,b) => b[1] - a[1]).map(([p, c]) => (
              <div key={p} className="flex items-center gap-2 text-xs">
                <span className="w-20 truncate">{p}</span>
                <Progress value={(c / results.length) * 100} className="h-1.5" />
                <span className="w-8 text-right">{c}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="h-4 w-4" /> AI Consistency metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Data Consistency</span>
                <span>{analysis?.dataConsistency}%</span>
              </div>
              <Progress value={analysis?.dataConsistency || 0} className="h-1.5" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Geographic Consistency</span>
                <span>{analysis?.geographicConsistency}%</span>
              </div>
              <Progress value={analysis?.geographicConsistency || 0} className="h-1.5" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
