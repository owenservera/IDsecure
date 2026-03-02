'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScanLine, Fingerprint, Camera, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ForensicsViewProps {
  forensics: any | null;
}

export function ForensicsView({ forensics }: ForensicsViewProps) {
  if (!forensics) {
    return (
      <Card className="h-64 flex items-center justify-center text-muted-foreground border-dashed">
        <div className="text-center">
          <ScanLine className="h-10 w-10 mx-auto mb-2 opacity-20" />
          <p>Upload an image to run forensics analysis</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-900 text-white border-slate-800">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-2">
            <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Authenticity Score</p>
            <p className="text-5xl font-black text-violet-500">{forensics.authenticityScore}%</p>
            <Badge className={forensics.deepfakeRisk === 'high' ? 'bg-red-500' : 'bg-green-500'}>
              {forensics.deepfakeRisk === 'high' ? 'HIGH RISK' : 'LOW RISK'}
            </Badge>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Fingerprint className="h-4 w-4" /> Forensics Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 grid grid-cols-2 gap-4">
            {forensics.imageMetadata && (
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Estimated Source</p>
                <p className="text-sm font-semibold flex items-center gap-1">
                  <Camera className="h-3 w-3" /> {forensics.imageMetadata.estimatedSource}
                </p>
              </div>
            )}
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Risk Assessment</p>
              <p className="text-sm font-semibold">{forensics.summary?.riskLevel?.toUpperCase()} RISK</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {forensics.forensicResults?.map((res: any, i: number) => (
          <Card key={i} className="border-l-4 border-l-violet-500">
            <CardHeader className="py-2 px-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500">{res.analysisType}</span>
                <span className="text-xs font-bold text-violet-600">{res.confidence}% Conf.</span>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-sm font-bold mb-1">{res.result}</p>
              <p className="text-xs text-muted-foreground">{res.details}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
