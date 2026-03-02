'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, Search, User, Clock, ChevronRight, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Investigation {
  id: string;
  name: string | null;
  email: string | null;
  username: string | null;
  createdAt: string;
  _count: {
    results: number;
  };
}

export function InvestigationHistory({ onSelect }: { onSelect: (id: string) => void }) {
  const { data: investigations, isLoading } = useQuery<Investigation[]>({
    queryKey: ['investigations'],
    queryFn: async () => {
      const response = await fetch('/api/investigations');
      const data = await response.json();
      return data.investigations;
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className="shadow-lg border-0">
      <CardHeader className="bg-slate-100 py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <History className="h-4 w-4" /> Investigation History
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {!investigations || investigations.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-xs">
            No previous investigations found
          </div>
        ) : (
          <div className="divide-y">
            {investigations.map((inv) => (
              <button
                key={inv.id}
                onClick={() => onSelect(inv.id)}
                className="w-full text-left p-3 hover:bg-slate-50 transition-colors flex items-center justify-between group"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate flex items-center gap-1">
                    <User className="h-3 w-3 text-slate-400" />
                    {inv.name || inv.username || inv.email || 'Anonymous'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {formatDistanceToNow(new Date(inv.createdAt), { addSuffix: true })}
                    </span>
                    <Badge variant="secondary" className="text-[10px] h-4">
                      {inv._count.results} results
                    </Badge>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500" />
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
