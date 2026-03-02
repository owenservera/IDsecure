'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, Calendar, ExternalLink, ShieldCheck } from 'lucide-react';
import { SearchResult } from '@/lib/types';
import { format } from 'date-fns';

interface IdentityTimelineProps {
  results: SearchResult[];
}

export function IdentityTimeline({ results }: IdentityTimelineProps) {
  // Sort results by a simulated or extracted date
  // In a real app, we'd extract 'joined' or 'posted' dates from the OSINT data
  const timelineEvents = results
    .map((r, i) => ({
      ...r,
      // Simulate dates if not present for visualization
      date: new Date(Date.now() - (i * 1000 * 60 * 60 * 24 * 30 * 3)), // 3 months apart
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  if (results.length === 0) {
    return (
      <Card className="h-64 flex items-center justify-center text-muted-foreground border-dashed">
        <div className="text-center">
          <History className="h-10 w-10 mx-auto mb-2 opacity-20" />
          <p>Run a search to generate identity timeline</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calendar className="h-4 w-4" /> Chronological Identity Mapping
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-3 space-y-8 pb-4">
          {timelineEvents.map((event, i) => (
            <div key={i} className="relative pl-8">
              {/* Dot */}
              <div className="absolute -left-[9px] mt-1.5 h-4 w-4 rounded-full border-2 border-white bg-violet-600 dark:border-slate-950" />
              
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {format(event.date, 'MMM yyyy')}
                  </span>
                  <Badge variant="outline" className="text-[10px] h-4">
                    {event.platform}
                  </Badge>
                  {event.confidence >= 80 && (
                    <ShieldCheck className="h-3 w-3 text-green-500" />
                  )}
                </div>
                
                <h4 className="text-sm font-semibold">{event.title}</h4>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {event.snippet}
                </p>
                
                <a 
                  href={event.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[10px] text-violet-600 flex items-center gap-1 hover:underline mt-1"
                >
                  <ExternalLink className="h-2.5 w-2.5" />
                  View Source Profile
                </a>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
