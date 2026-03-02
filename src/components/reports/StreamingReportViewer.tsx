'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, FileText, Loader2, CheckCircle2, AlertCircle, Eye } from 'lucide-react';

interface StreamEvent {
  type: 'stage' | 'results' | 'analysis' | 'complete' | 'error' | 'info';
  [key: string]: unknown;
}

interface ReportSection {
  id: string;
  title: string;
  content: string;
  status: 'pending' | 'generating' | 'complete';
  results?: unknown[];
}

interface StreamingReportViewerProps {
  investigationId: string;
  reportFormat?: 'pdf' | 'markdown';
  onComplete?: (reportUrl: string) => void;
  onError?: (error: string) => void;
}

export default function StreamingReportViewer({
  investigationId,
  reportFormat = 'pdf',
  onComplete,
  onError,
}: StreamingReportViewerProps) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [currentStage, setCurrentStage] = useState<string>('');
  const [totalResults, setTotalResults] = useState(0);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const eventSourceRef useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  }, []);

  const startStreaming = useCallback(async () => {
    setIsStreaming(true);
    setProgress(0);
    setSections([]);
    setTotalResults(0);
    setReportUrl(null);
    setError(null);
    setLogs([]);

    abortControllerRef.current = new AbortController();

    try {
      addLog('Starting report generation...');

      const response = await fetch('/api/report/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ investigationId, format: reportFormat }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body reader available');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          addLog('Stream completed');
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data: StreamEvent = JSON.parse(line.slice(6));

              switch (data.type) {
                case 'stage':
                  setCurrentStage(data.name as string || '');
                  setProgress(data.progress as number || 0);
                  addLog(`Stage: ${data.name}`);
                  break;

                case 'results':
                  setTotalResults(prev => prev + (data.results as unknown[]?.length || 0));
                  addLog(`Received ${data.results?.length || 0} results`);
                  break;

                case 'info':
                  addLog(data.message as string || 'Info received');
                  break;

                case 'complete':
                  setIsStreaming(false);
                  setProgress(100);
                  setReportUrl(data.reportUrl as string || null);
                  addLog('Report generation complete!');
                  onComplete?.(data.reportUrl as string);
                  break;

                case 'error':
                  const errorMsg = data.message as string || 'Unknown error';
                  setError(errorMsg);
                  setIsStreaming(false);
                  addLog(`Error: ${errorMsg}`);
                  onError?.(errorMsg);
                  break;
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', line, e);
            }
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setIsStreaming(false);
      addLog(`Error: ${errorMessage}`);
      onError?.(errorMessage);
    } finally {
      abortControllerRef.current = null;
    }
  }, [investigationId, reportFormat, onComplete, onError, addLog]);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      addLog('Streaming stopped by user');
    }
    setIsStreaming(false);
  }, [addLog]);

  const downloadReport = useCallback(() => {
    if (reportUrl) {
      const link = document.createElement('a');
      link.href = reportUrl;
      link.download = `investigation-${investigationId}.${reportFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addLog(`Downloaded report: investigation-${investigationId}.${reportFormat}`);
    }
  }, [reportUrl, investigationId, reportFormat, addLog]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Streaming Report Viewer
          </CardTitle>
          <CardDescription>
            Investigation ID: {investigationId} • Format: {reportFormat.toUpperCase()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Progress Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isStreaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : reportUrl ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm font-medium">
                  {isStreaming ? 'Generating report...' : reportUrl ? 'Report ready' : 'Ready to generate'}
                </span>
              </div>
              <Badge variant={isStreaming ? 'default' : reportUrl ? 'success' : 'secondary'}>
                {isStreaming ? 'In Progress' : reportUrl ? 'Complete' : 'Pending'}
              </Badge>
            </div>

            {isStreaming && (
              <>
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-muted-foreground">
                  {currentStage || 'Initializing...'}
                </p>
              </>
            )}

            {/* Control Buttons */}
            <div className="flex gap-2">
              {!isStreaming && !reportUrl && (
                <Button onClick={startStreaming} className="flex-1">
                  <Eye className="mr-2 h-4 w-4" />
                  Generate Report
                </Button>
              )}
              {isStreaming && (
                <Button onClick={stopStreaming} variant="outline" className="flex-1">
                  Stop Generation
                </Button>
              )}
              {reportUrl && (
                <Button onClick={downloadReport} className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Download Report
                </Button>
              )}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Stats Display */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{totalResults}</p>
              <p className="text-xs text-muted-foreground">Total Results</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{sections.length}</p>
              <p className="text-xs text-muted-foreground">Sections</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{progress.toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground">Progress</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px] rounded-md border p-4">
            <div className="space-y-1">
              {logs.length === 0 && (
                <p className="text-sm text-muted-foreground">No activity yet</p>
              )}
              {logs.map((log, index) => (
                <p key={index} className="text-xs font-mono">
                  {log}
                </p>
              ))}
              {isStreaming && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Processing...</span>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
