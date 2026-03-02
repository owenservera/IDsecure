'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Skull, AlertTriangle, CheckCircle2, Lock, Flame } from 'lucide-react';
import { RiskAssessment, BreachResult } from '@/lib/types';

interface RiskAssessmentViewProps {
  risk: RiskAssessment | null;
  breaches: BreachResult | null;
  darkWeb?: any | null;
}

export function RiskAssessmentView({ risk, breaches, darkWeb }: RiskAssessmentViewProps) {
  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel?.toLowerCase()) {
      case 'critical': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  if (!risk && !breaches && !darkWeb) {
    return (
      <Card className="h-64 flex items-center justify-center text-muted-foreground border-dashed">
        <div className="text-center">
          <Shield className="h-10 w-10 mx-auto mb-2 opacity-20" />
          <p>Run SOTA analysis to see risk assessment</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="bg-red-50/50 py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 text-red-600" /> Overall Risk Assessment
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="text-center py-4 bg-slate-50 rounded-lg">
              <p className={`text-5xl font-bold ${getRiskColor(risk?.overallRiskLevel || 'low')}`}>
                {risk?.riskScore || 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Risk Score (0-100)</p>
              <Badge className={`mt-2 ${getSeverityColor(risk?.overallRiskLevel || 'low')}`}>
                {risk?.overallRiskLevel?.toUpperCase() || 'LOW'} RISK
              </Badge>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold">Risk Factors</p>
              {risk?.riskFactors?.map((f, i) => (
                <div key={i} className="flex items-start gap-2 p-2 bg-slate-50 rounded text-xs">
                  <AlertTriangle className={`h-3 w-3 mt-0.5 ${getRiskColor(f.severity)}`} />
                  <div>
                    <p className="font-medium">{f.factor}</p>
                    <p className="text-muted-foreground">{f.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardHeader className="bg-red-900 text-white py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Flame className="h-4 w-4 animate-pulse" /> Dark Web Deep-Check
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {darkWeb ? (
              <>
                <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                  <div>
                    <p className="text-sm font-bold text-red-900">Intelligence Summary</p>
                    <p className="text-xs text-red-700">{darkWeb.summary}</p>
                  </div>
                  <Badge variant="destructive" className="uppercase font-black">{darkWeb.threatLevel}</Badge>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Detected Leaks</p>
                  {darkWeb.leaks?.map((leak: any, i: number) => (
                    <div key={i} className="p-3 border-l-2 border-l-red-600 bg-slate-50 rounded-r-lg text-xs">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold">{leak.source}</span>
                        <span className="text-[10px] text-muted-foreground">{leak.date}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {leak.exposedData.map((data: string, j: number) => (
                          <Badge key={j} variant="outline" className="text-[9px] bg-white">{data}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-muted-foreground italic text-sm">
                No dark web identifiers provided for scan.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="bg-slate-50 py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Skull className="h-4 w-4" /> Public Breach Monitor
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div>
              <p className="text-sm font-medium">Data Breaches</p>
              <p className="text-xs text-muted-foreground">{breaches?.breachResults?.length || 0} incidents detected</p>
            </div>
            <Badge className={getSeverityColor(breaches?.overallRisk || 'low')}>
              {breaches?.overallRisk?.toUpperCase() || 'LOW'}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {breaches?.breachResults?.length === 0 ? (
              <div className="col-span-2 text-center py-8">
                <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No public breaches detected</p>
              </div>
            ) : (
              breaches?.breachResults?.map((b, i) => (
                <div key={i} className="p-3 border rounded-lg text-xs hover:shadow-sm transition-shadow">
                  <div className="flex justify-between items-center mb-1">
                    <p className="font-bold">{b.title}</p>
                    <Badge variant="outline" className="text-[10px]">{b.severity}</Badge>
                  </div>
                  <p className="text-muted-foreground mb-2 line-clamp-2">{b.description}</p>
                  <div className="flex gap-1 flex-wrap">
                    {b.exposedData.map((d, j) => (
                      <Badge key={j} variant="secondary" className="text-[10px] px-1">{d}</Badge>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
