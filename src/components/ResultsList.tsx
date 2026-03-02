'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Radar, MapPin, Building, Globe, Eye, Target, Loader2 } from 'lucide-react';
import { SearchResult } from '@/lib/types';
import { platformIcons } from './platform-icons';

interface ResultsListProps {
  results: SearchResult[];
  isSearching: boolean;
  onGenerateEngagement: () => void;
  isGeneratingEngagement: boolean;
}

export function ResultsList({ results, isSearching, onGenerateEngagement, isGeneratingEngagement }: ResultsListProps) {
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    if (confidence >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <Card className="shadow-lg border-0">
      <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-700 text-white rounded-t-lg py-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Discovered Profiles
          </CardTitle>
          <div className="flex items-center gap-2">
            {results.length > 0 && (
              <>
                <Badge variant="secondary">{results.length} profiles</Badge>
                <Button size="sm" variant="secondary" onClick={onGenerateEngagement} disabled={isGeneratingEngagement}>
                  {isGeneratingEngagement ? <Loader2 className="h-3 w-3 animate-spin" /> : <Target className="h-3 w-3" />}
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {results.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Radar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No profiles discovered yet</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="p-2 space-y-2">
              {results.map((result, index) => (
                <Card key={index} className={`hover:shadow-md transition-shadow ${result.confidence >= 80 ? 'border-l-4 border-l-green-500' : result.confidence >= 60 ? 'border-l-4 border-l-yellow-500' : ''}`}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded">
                        {platformIcons[result.platform] || <Globe className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-sm truncate">{result.title}</h3>
                          <Badge variant="outline" className="text-xs shrink-0">{result.platform}</Badge>
                          <span className={`text-xs font-medium ml-auto shrink-0 ${getConfidenceColor(result.confidence)}`}>
                            {result.confidence.toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">{result.snippet}</p>
                        <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                          {result.location && <span><MapPin className="h-3 w-3 inline" /> {result.location}</span>}
                          {result.company && <span><Building className="h-3 w-3 inline" /> {result.company}</span>}
                        </div>
                        <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-600 hover:underline block mt-1 truncate">
                          {result.url}
                        </a>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

// Minimal Button component to avoid circular dependency if needed, 
// but using the one from @/components/ui/button is preferred.
import { Button } from '@/components/ui/button';
