'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Terminal, Cpu, Play, RefreshCcw, Server, ShieldCheck, Box } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MCPTool {
  name: string;
  description: string;
  server: string;
  inputSchema?: any;
}

export function MCPToolsView() {
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [loading, setLoading] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [executingTool, setExecutingTool] = useState<string | null>(null);

  const fetchTools = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/mcp');
      const data = await res.json();
      if (data.success) setTools(data.tools);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTools();
  }, []);

  const runTool = async (server: string, tool: string) => {
    setExecutingTool(tool);
    setExecutionResult(null);
    try {
      const res = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server, tool, args: {} }) // Simple demo with no args
      });
      const data = await res.json();
      setExecutionResult(data.result);
    } catch (e) {
      setExecutionResult({ error: String(e) });
    } finally {
      setExecutingTool(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
      {/* Left: Tools List */}
      <Card className="lg:col-span-1 border-slate-200 dark:border-slate-800">
        <CardHeader className="bg-slate-50 dark:bg-slate-900/50 py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Box className="h-4 w-4" /> Connected MCP Tools
            </CardTitle>
            <Button size="icon" variant="ghost" onClick={fetchTools} disabled={loading}>
              <RefreshCcw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <CardDescription className="text-[10px]">Specialized modules from external OSINT servers</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {tools.map((tool, i) => (
                <div key={i} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold font-mono text-violet-600">{tool.name}</span>
                    <Badge variant="outline" className="text-[9px] uppercase tracking-tighter">{tool.server}</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground line-clamp-2 mb-2">{tool.description}</p>
                  <Button 
                    size="sm" 
                    className="w-full h-7 text-[10px] bg-slate-900"
                    disabled={executingTool === tool.name}
                    onClick={() => runTool(tool.server, tool.name)}
                  >
                    {executingTool === tool.name ? 'Executing...' : <><Play className="h-3 w-3 mr-1" /> Deploy Tool</>}
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Right: Execution Console */}
      <Card className="lg:col-span-2 bg-slate-950 text-emerald-500 border-slate-800 font-mono">
        <CardHeader className="border-b border-slate-800 py-2">
          <CardTitle className="text-xs flex items-center gap-2">
            <Terminal className="h-3 w-3" /> Intelligence Output Console
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <ScrollArea className="h-[450px]">
            {executionResult ? (
              <pre className="text-[11px] whitespace-pre-wrap">
                {JSON.stringify(executionResult, null, 2)}
              </pre>
            ) : (
              <div className="flex flex-col items-center justify-center h-full opacity-30 mt-20">
                <Cpu className="h-12 w-12 mb-4 animate-pulse" />
                <p className="text-xs uppercase tracking-widest text-center">
                  Select a tool to initialize <br /> intelligence stream
                </p>
              </div>
            )}
          </ScrollArea>
          
          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] uppercase text-emerald-900 font-bold">Terminal Active - Secure Uplink Stable</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
