'use client';

import { useState, useRef, useCallback } from 'react';
import {
  ResearchSequence,
  ResearchSequenceExecution,
  ResearchStepResult,
} from '@/lib/types/research-sequence';
import {
  Play,
  Square,
  CheckCircle2,
  XCircle,
  Loader2,
  SkipForward,
  AlertTriangle,
  Clock,
  TrendingUp,
  Database,
  FileText,
  Download,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ResearchSequenceRunnerProps {
  sequence: ResearchSequence;
  initialSubject?: {
    name?: string;
    email?: string;
    phone?: string;
    username?: string;
    imageBase64?: string;
    hints?: any;
  };
}

function getIconForStep(type: string) {
  const icons: Record<string, any> = {
    image_analysis: '🖼️',
    face_search: '👤',
    username_search: '@',
    email_search: '✉️',
    phone_search: '📞',
    name_search: '👤',
    forensics: '🔬',
    risk_assessment: '⚠️',
    breach_check: '🗄️',
    dark_web_search: '🌐',
    entity_resolution: '👆',
    report_generation: '📄',
  };
  return icons[type] || '📌';
}

function StepStatus({
  result,
  index,
  total,
  isRunning,
}: {
  result: ResearchStepResult;
  index: number;
  total: number;
  isRunning: boolean;
}) {
  const statusIcons = {
    pending: <Clock className="h-4 w-4 text-muted-foreground" />,
    running: <Loader2 className="h-4 w-4 animate-spin text-blue-600" />,
    completed: <CheckCircle2 className="h-4 w-4 text-green-600" />,
    failed: <XCircle className="h-4 w-4 text-red-600" />,
    skipped: <SkipForward className="h-4 w-4 text-muted-foreground" />,
    cancelled: <Square className="h-4 w-4 text-orange-600" />,
  };

  const statusColors = {
    pending: 'bg-slate-100 text-slate-600',
    running: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    skipped: 'bg-slate-100 text-slate-500',
    cancelled: 'bg-orange-100 text-orange-700',
  };

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'flex items-center justify-center w-8 h-8 rounded-full',
          statusColors[result.status]
        )}
      >
        {statusIcons[result.status]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{index + 1}. {result.stepName}</span>
          {result.status === 'running' && isRunning && (
            <Badge variant="outline" className="text-xs animate-pulse">
              Running...
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {result.duration && (
            <span>{(result.duration / 1000).toFixed(1)}s</span>
          )}
          {result.error && (
            <span className="text-red-600">{result.error}</span>
          )}
          {result.status === 'skipped' && (
            <span>Skipped - condition not met</span>
          )}
        </div>
      </div>
      {result.data && (
        <Badge variant="outline" className="text-xs">
          <Database className="h-3 w-3 mr-1" />
          Data
        </Badge>
      )}
    </div>
  );
}

export function ResearchSequenceRunner({
  sequence,
  initialSubject = {},
}: ResearchSequenceRunnerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [execution, setExecution] = useState<ResearchSequenceExecution | null>(null);
  const [subject, setSubject] = useState(initialSubject);
  const [showSubjectDialog, setShowSubjectDialog] = useState(false);
  const [selectedResult, setSelectedResult] = useState<ResearchStepResult | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);

  const runSequence = useCallback(async () => {
    if (!sequence.steps.filter((s) => s.enabled).length) {
      alert('No enabled steps in sequence');
      return;
    }

    // Check if we need subject input
    const needsSubject = !subject.name && !subject.email && !subject.phone && !subject.username && !subject.imageBase64;
    if (needsSubject) {
      setShowSubjectDialog(true);
      return;
    }

    setIsRunning(true);

    try {
      const response = await fetch('/api/research/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sequence,
          subject,
        }),
      });

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              switch (data.type) {
                case 'start':
                  setExecution(data.execution);
                  break;
                case 'step_start':
                  setExecution((prev) => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      results: [
                        ...prev.results,
                        {
                          stepId: data.stepId,
                          stepName: data.stepName,
                          status: 'running',
                          startTime: new Date().toISOString(),
                        },
                      ],
                    };
                  });
                  break;
                case 'step_complete':
                  setExecution((prev) => {
                    if (!prev) return prev;
                    const newResults = [...prev.results];
                    const lastIndex = newResults.findIndex(
                      (r) => r.stepId === data.result.stepId && r.status === 'running'
                    );
                    if (lastIndex !== -1) {
                      newResults[lastIndex] = data.result;
                    }
                    return {
                      ...prev,
                      results: newResults,
                      context: data.context,
                    };
                  });
                  break;
                case 'step_skipped':
                  setExecution((prev) => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      results: [...prev.results, data.result],
                    };
                  });
                  break;
                case 'complete':
                  setExecution(data.execution);
                  setIsRunning(false);
                  break;
                case 'error':
                  setExecution((prev) => prev ? { ...prev, status: 'failed', error: data.error } : null);
                  setIsRunning(false);
                  break;
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Sequence execution failed:', error);
      setIsRunning(false);
      setExecution((prev) =>
        prev
          ? {
              ...prev,
              status: 'failed',
              error: error instanceof Error ? error.message : 'Unknown error',
              endTime: new Date().toISOString(),
            }
          : null
      );
    }
  }, [sequence, subject]);

  const stopSequence = useCallback(() => {
    setIsRunning(false);
    setExecution((prev) =>
      prev
        ? {
            ...prev,
            status: 'cancelled',
            endTime: new Date().toISOString(),
          }
        : null
    );
  }, []);

  const resetExecution = useCallback(() => {
    setExecution(null);
    setIsRunning(false);
  }, []);

  const viewResult = useCallback((result: ResearchStepResult) => {
    setSelectedResult(result);
    setShowResultDialog(true);
  }, []);

  const downloadResults = useCallback(() => {
    if (!execution) return;
    
    const blob = new Blob([JSON.stringify(execution, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `research_${sequence.id}_${new Date().toISOString().slice(0, 19)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [execution, sequence.id]);

  const completedSteps = execution?.results.filter((r) => r.status === 'completed').length || 0;
  const totalEnabledSteps = sequence.steps.filter((s) => s.enabled).length;
  const progress = totalEnabledSteps > 0 ? (completedSteps / totalEnabledSteps) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Control Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl">🔬</div>
              <div>
                <h3 className="font-semibold">{sequence.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {sequence.steps.length} steps • {sequence.steps.filter((s) => s.enabled).length} enabled
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isRunning && !execution && (
                <Button onClick={runSequence} size="sm">
                  <Play className="h-4 w-4 mr-1" /> Run
                </Button>
              )}
              {isRunning && (
                <Button onClick={stopSequence} variant="destructive" size="sm">
                  <Square className="h-4 w-4 mr-1" /> Stop
                </Button>
              )}
              {execution && !isRunning && (
                <>
                  <Button onClick={resetExecution} variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-1" /> Reset
                  </Button>
                  <Button onClick={downloadResults} variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-1" /> Export
                  </Button>
                  <Button onClick={runSequence} size="sm">
                    <Play className="h-4 w-4 mr-1" /> Run Again
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {execution && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {execution.status === 'running' && 'Running...'}
                  {execution.status === 'completed' && 'Completed'}
                  {execution.status === 'failed' && 'Failed'}
                  {execution.status === 'cancelled' && 'Cancelled'}
                </span>
                <span className="font-medium">
                  {completedSteps}/{totalEnabledSteps} steps
                </span>
              </div>
              <Progress value={progress} className="h-2" />
              {execution.totalDuration && (
                <p className="text-xs text-muted-foreground text-right">
                  Total: {(execution.totalDuration / 1000).toFixed(1)}s
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Steps Status */}
      {execution && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Execution Status</Label>
              <Badge
                variant={
                  execution.status === 'completed'
                    ? 'default'
                    : execution.status === 'failed'
                    ? 'destructive'
                    : 'outline'
                }
                className="capitalize"
              >
                {execution.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              <div className="space-y-3">
                {execution.results.map((result, index) => (
                  <div
                    key={result.stepId}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg p-2 transition-colors"
                    onClick={() => viewResult(result)}
                  >
                    <StepStatus
                      result={result}
                      index={index}
                      total={execution.results.length}
                      isRunning={isRunning}
                    />
                  </div>
                ))}
                {execution.results.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                    <p className="text-sm">Starting execution...</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Subject Input Dialog */}
      <Dialog open={showSubjectDialog} onOpenChange={setShowSubjectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Subject Information</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={subject.name || ''}
                onChange={(e) => setSubject({ ...subject, name: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={subject.email || ''}
                onChange={(e) => setSubject({ ...subject, email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={subject.phone || ''}
                onChange={(e) => setSubject({ ...subject, phone: e.target.value })}
                placeholder="+1234567890"
              />
            </div>
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={subject.username || ''}
                onChange={(e) => setSubject({ ...subject, username: e.target.value })}
                placeholder="@username"
              />
            </div>
            <Button onClick={() => { setShowSubjectDialog(false); runSequence(); }} className="w-full">
              <Play className="h-4 w-4 mr-1" /> Start Research
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Result Detail Dialog */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedResult?.stepName} - {selectedResult?.status}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-96">
            {selectedResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Status:</span>{' '}
                    <Badge variant="outline" className="capitalize">
                      {selectedResult.status}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Duration:</span>{' '}
                    {(selectedResult.duration || 0 / 1000).toFixed(2)}s
                  </div>
                  {selectedResult.metadata?.model && (
                    <div>
                      <span className="text-muted-foreground">Model:</span>{' '}
                      <code className="text-xs">{selectedResult.metadata.model}</code>
                    </div>
                  )}
                </div>

                {selectedResult.error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-red-700">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-medium">Error</span>
                    </div>
                    <p className="text-sm mt-1">{selectedResult.error}</p>
                  </div>
                )}

                {selectedResult.data && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Extracted Data
                    </h4>
                    <pre className="bg-slate-100 dark:bg-slate-900 rounded-lg p-3 text-xs overflow-auto max-h-64">
                      {JSON.stringify(selectedResult.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
