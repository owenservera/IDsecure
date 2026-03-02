'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Quote, Fingerprint, Type, Info } from 'lucide-react';

interface StylometryWidgetProps {
  analysis: any | null;
}

export function StylometryWidget({ analysis }: StylometryWidgetProps) {
  if (!analysis) return null;

  return (
    <Card className="h-full border-l-4 border-l-emerald-500">
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Type className="h-4 w-4" /> Forensic Stylometry Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Consistency Score</p>
            <p className="text-2xl font-black text-emerald-600">{analysis.consistencyScore}%</p>
          </div>
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">
            {analysis.verdict}
          </Badge>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
            <Fingerprint className="h-2.5 w-2.5" /> Linguistic Markers
          </p>
          <div className="flex flex-wrap gap-1">
            {analysis.linguisticMarkers?.map((marker: string, i: number) => (
              <Badge key={i} variant="secondary" className="text-[10px] font-normal px-2 py-0.5">
                {marker}
              </Badge>
            ))}
          </div>
        </div>

        {analysis.matchMatrix && analysis.matchMatrix.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground uppercase font-bold">Linguistic Correlations</p>
            <div className="space-y-2">
              {analysis.matchMatrix.map((match: any, i: number) => (
                <div key={i} className="p-2 border rounded text-[11px] bg-white">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold">Profiles {match.profiles.join(' & ')}</span>
                    <span className="text-emerald-600 font-bold">{match.matchLikelihood} Match</span>
                  </div>
                  <ul className="list-disc list-inside text-muted-foreground">
                    {match.reasons.slice(0, 2).map((r: string, j: number) => (
                      <li key={j} className="truncate">{r}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
