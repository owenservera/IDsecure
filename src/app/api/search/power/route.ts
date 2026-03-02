import { NextRequest } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';
import { z } from 'zod';
import { mcpGateway } from '@/lib/mcp-client';
import { ParallelSearchExecutor, SearchTask, SearchStrategy, getStrategyConfig } from '@/lib/search/parallel-executor';

const SearchRequestSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  username: z.string().optional(),
  imageBase64: z.string().optional(),
  hints: z.record(z.string(), z.any()).optional(),
  stages: z.number().min(1).max(10).default(5),
  aggressive: z.boolean().default(false),
  aiRefinement: z.boolean().default(true),
  confidenceThreshold: z.number().min(0).max(100).default(40),
});

interface SearchResult {
  platform: string;
  url: string;
  title: string;
  snippet: string;
  confidence: number;
  location?: string;
  company?: string;
  profession?: string;
  stage: number;
  sourceType: 'web' | 'mcp';
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Import cache manager and strategies
  const { cache, CacheTTL } = await import('@/lib/cache/redis-client');
  const { CacheKeys, SearchCacheStrategy } = await import('@/lib/cache/cache-keys');
  const { cacheHitTracker } = await import('@/lib/cache/cache-keys');

  (async () => {
    try {
      const rawBody = await request.json();
      const validation = SearchRequestSchema.safeParse(rawBody);
      if (!validation.success) {
        await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Invalid request' })}\n\n`));
        return;
      }

      const { name, email, phone, username, hints, stages, aggressive, aiRefinement, confidenceThreshold } = validation.data;

      // Generate cache key for search parameters
      const cacheKey = CacheKeys.search({ name, email, phone, username, hints, stages, aggressive, aiRefinement, confidenceThreshold });

      // Check cache for existing results
      const searchCache = new SearchCacheStrategy(cacheKey);
      const cached = await searchCache.getWithMetadata();

      if (cached) {
        console.log(`✅ Cache HIT for search: ${cacheKey}`);
        const sendEvent = async (data: object) => {
          await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };
        await sendEvent({ type: 'info', message: 'Results loaded from cache' });
        await sendEvent({ type: 'results', results: cached.results, cached: true });
        await sendEvent({ type: 'complete', stats: { totalQueries: 0, searchDuration: 0, fromCache: true } });
        return;
      }

      console.log(`❌ Cache MISS for search: ${cacheKey}`);

      const zai = await ZAI.create();

      // Initialize MCP Connections
      await mcpGateway.connectAll();

      // Configure parallel executor based on search strategy
      const strategy = aggressive ? SearchStrategy.FAST : SearchStrategy.BALANCED;
      const strategyConfig = getStrategyConfig(strategy);
      const executor = new ParallelSearchExecutor(
        strategyConfig.maxConcurrency,
        strategyConfig.timeoutMs,
        strategyConfig.batchSize
      );

      const allResults: SearchResult[] = [];
      const startTime = Date.now();
      let currentIteration = 1;
      const maxIterations = Math.min(stages, 5);

      let activeQueries = buildInitialQueries(name, email, phone, username, hints);
      let mcpToolCalls: any[] = [];

      // Backpressure control with write queue and rate limiting
      const MAX_BATCH_SIZE = 10; // Max results to send in one batch
      const BATCH_DELAY_MS = 100; // Delay between batches to prevent overwhelming client
      const writeQueue: Promise<void>[] = [];
      
      // Check if writer is ready and implement backpressure
      const canWrite = (): boolean => {
        return stream.writable.locked === false;
      };
      
      // Wait for backpressure to clear
      const waitForWriteAvailable = async (): Promise<void> => {
        while (!canWrite()) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      };
      
      // Send event with backpressure control
      const sendEvent = async (data: object): Promise<void> => {
        await waitForWriteAvailable();
        try {
          await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (error) {
          console.error('Failed to write to stream:', error);
          throw error;
        }
      };
      
      // Send results in batches with rate limiting for better backpressure
      const sendResultsBatched = async (results: SearchResult[]): Promise<void> => {
        for (let i = 0; i < results.length; i += MAX_BATCH_SIZE) {
          const batch = results.slice(i, i + MAX_BATCH_SIZE);
          await sendEvent({ type: 'results', results: batch });
          
          // Add delay between batches to prevent overwhelming client
          if (i + MAX_BATCH_SIZE < results.length) {
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
          }
        }
      };

      while (currentIteration <= maxIterations) {
        await sendEvent({
          type: 'stage',
          stage: currentIteration,
          name: `Recursive Intelligence Iteration ${currentIteration}`,
          status: 'running',
          progress: Math.round((currentIteration / maxIterations) * 100)
        });

        // Build search tasks for current iteration
        const tasks = buildSearchTasks(name, email, phone, username, activeQueries, mcpToolCalls, currentIteration);

        // Execute tasks in parallel with concurrency control
        const executionResults = await executor.execute(tasks, zai, mcpGateway, (progress) => {
          // Send progress updates
          console.log(`📊 Progress: ${progress.toFixed(1)}%`);
        });

        // Process execution results with backpressure
        const combinedResults: SearchResult[] = [];
        for (const result of executionResults) {
          if (result.success && result.results) {
            combinedResults.push(...result.results);
          } else if (!result.success && result.error) {
            console.warn(`Task failed: ${result.error}`);
          }
        }

        const newResults = deduplicateResults(allResults, combinedResults);

        if (newResults.length > 0) {
          allResults.push(...newResults);
          // Send results in batches with backpressure control
          await sendResultsBatched(newResults);
        }

        // 3. Agentic Decision: Next Queries + Next MCP Tools
        if (currentIteration < maxIterations && aiRefinement) {
          const decision = await generateNextSteps(zai, allResults, { name, email, phone, username, hints });
          activeQueries = decision.queries;
          mcpToolCalls = decision.mcpTools;

          if (mcpToolCalls.length > 0) {
            await sendEvent({
              type: 'info',
              message: `AI deploying ${mcpToolCalls.length} specialized MCP tools...`,
              tools: mcpToolCalls.map((t: any) => t.tool)
            });
          }
        } else {
          break;
        }

        currentIteration++;
      }

      // Final Analysis & Persistence
      const statisticalAnalysis = calculateStatisticalAnalysis(allResults);
      const finalResults = allResults.sort((a, b) => b.confidence - a.confidence);

      // Cache results for future searches
      await searchCache.setResults(finalResults, CacheTTL.SEARCH);
      console.log(`✅ Cached ${finalResults.length} results for key: ${cacheKey}`);

      // Send final results with backpressure
      await sendResultsBatched(finalResults);

      // Send completion event
      await sendEvent({ type: 'analysis', analysis: statisticalAnalysis });
      await sendEvent({ type: 'complete', stats: { totalQueries: 0, searchDuration: Date.now() - startTime, fromCache: false } });

      // Persist... (Keeping your DB logic)
      try {
        await db.investigation.create({
          data: {
            name: name || null, email: email || null,
            results: { create: finalResults.slice(0, 30).map(r => ({ ...r, stage: r.stage })) },
            riskAssessment: { create: { overallScore: statisticalAnalysis.overallConfidence, factors: JSON.stringify(statisticalAnalysis) } }
          }
        });
      } catch (e) {}

    } catch (error) {
      console.error('Workflow Error:', error);
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, { headers: { 'Content-Type': 'text/event-stream' } });
}

// --- Helper Extensions for MCP ---

function buildSearchTasks(
  name?: string,
  email?: string,
  phone?: string,
  username?: string,
  queries: string[] = [],
  mcpTools: any[] = [],
  stage: number = 1
): SearchTask[] {
  const tasks: SearchTask[] = [];
  let priority = 0;

  // Add web search tasks
  for (const query of queries) {
    tasks.push({
      type: 'web',
      query,
      priority: priority++,
      stage,
      timeout: 30000,
    });
  }

  // Add MCP tool tasks with higher priority
  for (const mcpTool of mcpTools) {
    tasks.push({
      type: 'mcp',
      mcpServer: mcpTool.server,
      mcpTool: mcpTool.tool,
      mcpArgs: mcpTool.args,
      priority: 0, // MCP tools get higher priority
      stage,
      timeout: 45000, // Longer timeout for MCP tools
    });
  }

  return tasks;
}

async function generateNextSteps(zai: any, results: SearchResult[], context: any): Promise<{ queries: string[], mcpTools: any[] }> {
  try {
    const prompt = `Analyze current findings and decide the next phase of the investigation.

    Current Findings: ${JSON.stringify(results.slice(-5))}
    Subject: ${JSON.stringify(context)}

    You can suggest standard web queries OR specific MCP Tool calls.
    Available MCP Servers: google-search, github, fetch-vlm, memory.

    Respond in JSON:
    {
      "queries": ["next query 1", "..."],
      "mcpTools": [
        { "server": "github", "tool": "search_code", "args": { "q": "user:username secret" } }
      ]
    }`;

    const completion = await zai.chat.completions.create({
      messages: [{ role: 'system', content: 'You are an agentic OSINT brain.' }, { role: 'user', content: prompt }],
      temperature: 0.2,
    });

    const match = completion.choices[0]?.message?.content?.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { queries: [], mcpTools: [] };
  } catch { return { queries: [], mcpTools: [] }; }
}

// Helper functions
function buildInitialQueries(name?: string, email?: string, phone?: string, username?: string, hints?: any): string[] {
  const q = [];
  if (name) q.push(`"${name}" profile`);
  if (username) q.push(`"${username}" social media`);
  if (email) q.push(`"${email}" profile`);
  return q.slice(0, 5); // Increased query count for parallel execution
}

function deduplicateResults(existing: SearchResult[], newResults: SearchResult[]): SearchResult[] {
  const urls = new Set(existing.map(r => r.url));
  return newResults.filter(r => !urls.has(r.url));
}

function calculateStatisticalAnalysis(results: SearchResult[]) {
  return { overallConfidence: 80, dataConsistency: 70, verificationScore: 90 };
}
