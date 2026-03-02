import ZAI from 'z-ai-web-dev-sdk';
import { SearchResult } from '@/lib/types';

/**
 * Search task definition
 */
export interface SearchTask {
  type: 'web' | 'mcp' | 'image';
  query?: string;
  mcpServer?: string;
  mcpTool?: string;
  mcpArgs?: Record<string, unknown>;
  priority: number; // Lower = higher priority
  stage: number;
  timeout?: number;
}

/**
 * Search execution result
 */
export interface SearchExecutionResult {
  results: SearchResult[];
  task: SearchTask;
  duration: number;
  success: boolean;
  error?: string;
}

/**
 * Parallel Search Executor
 * Executes multiple search tasks concurrently with intelligent concurrency control
 */
export class ParallelSearchExecutor {
  private maxConcurrency: number;
  private timeoutMs: number;
  private batchSize: number;

  constructor(
    maxConcurrency: number = 10,
    timeoutMs: number = 30000,
    batchSize: number = 5
  ) {
    this.maxConcurrency = maxConcurrency;
    this.timeoutMs = timeoutMs;
    this.batchSize = batchSize;
  }

  /**
   * Execute multiple search tasks in parallel with concurrency control
   */
  async execute(
    tasks: SearchTask[],
    zai: any,
    mcpGateway?: any,
    onProgress?: (progress: number) => void
  ): Promise<SearchExecutionResult[]> {
    const results: SearchExecutionResult[] = [];
    const executing: Promise<void>[] = [];
    let completed = 0;
    const totalTasks = tasks.length;

    // Sort tasks by priority
    const sortedTasks = [...tasks].sort((a, b) => a.priority - b.priority);

    for (const task of sortedTasks) {
      const promise = this.executeSingleTask(task, zai, mcpGateway)
        .then(result => {
          results.push(result);
          completed++;

          if (onProgress) {
            onProgress((completed / totalTasks) * 100);
          }
        })
        .catch(error => {
          results.push({
            results: [],
            task,
            duration: 0,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          completed++;

          if (onProgress) {
            onProgress((completed / totalTasks) * 100);
          }
        })
        .finally(() => {
          executing.splice(executing.indexOf(promise), 1);
        });

      executing.push(promise);

      // Wait if we've reached max concurrency
      if (executing.length >= this.maxConcurrency) {
        await Promise.race(executing);
      }
    }

    // Wait for all remaining tasks
    await Promise.all(executing);

    // Sort results by duration (fastest first)
    return results.sort((a, b) => a.duration - b.duration);
  }

  /**
   * Execute a single search task with timeout
   */
  private async executeSingleTask(
    task: SearchTask,
    zai: any,
    mcpGateway?: any
  ): Promise<SearchExecutionResult> {
    const startTime = Date.now();

    try {
      let searchResults: SearchResult[] = [];

      if (task.type === 'web' && task.query) {
        searchResults = await this.executeWebSearch(zai, task.query, task.stage);
      } else if (task.type === 'mcp' && mcpGateway) {
        searchResults = await this.executeMCPSearch(
          mcpGateway,
          task.mcpServer!,
          task.mcpTool!,
          task.mcpArgs || {},
          task.stage
        );
      } else if (task.type === 'image') {
        // Image search implementation
        searchResults = [];
      }

      return {
        results: searchResults,
        task,
        duration: Date.now() - startTime,
        success: true,
      };
    } catch (error) {
      return {
        results: [],
        task,
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute web search using ZAI
   */
  private async executeWebSearch(
    zai: any,
    query: string,
    stage: number
  ): Promise<SearchResult[]> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Web search timeout: ${query}`)), this.timeoutMs);
    });

    const searchPromise = zai.functions.invoke('web_search', {
      query,
      num: 10,
    });

    try {
      const result = await Promise.race([searchPromise, timeoutPromise]);

      return (result as any[]).map((item: any) => ({
        platform: this.detectPlatform(item.url || ''),
        url: item.url || '',
        title: item.name || 'Unknown',
        snippet: item.snippet || '',
        confidence: this.calculateBaseConfidence(item),
        stage,
        sourceType: 'web' as const,
      }));
    } catch (error) {
      console.error('Web search error:', error);
      return [];
    }
  }

  /**
   * Execute MCP tool search
   */
  private async executeMCPSearch(
    mcpGateway: any,
    server: string,
    tool: string,
    args: Record<string, unknown>,
    stage: number
  ): Promise<SearchResult[]> {
    try {
      const result = await Promise.race([
        mcpGateway.callTool(server, tool, args),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`MCP timeout: ${server}.${tool}`)), this.timeoutMs)
        ),
      ]);

      const content = result.content?.[0]?.text || '';

      return [{
        platform: `MCP:${server.toUpperCase()}`,
        url: '#',
        title: `MCP Insight: ${server}`,
        snippet: content.substring(0, 500),
        confidence: 85,
        stage,
        sourceType: 'web' as const,
        metadata: {
          mcpServer: server,
          mcpTool: tool,
          mcpArgs: args,
        },
      }];
    } catch (error) {
      console.error(`MCP error [${server}.${tool}]:`, error);
      return [];
    }
  }

  /**
   * Detect platform from URL
   */
  private detectPlatform(url: string): string {
    const urlLower = url.toLowerCase();

    const platformMap: Record<string, string> = {
      'linkedin.com': 'LinkedIn',
      'twitter.com': 'Twitter/X',
      'x.com': 'Twitter/X',
      'facebook.com': 'Facebook',
      'instagram.com': 'Instagram',
      'github.com': 'GitHub',
      'youtube.com': 'YouTube',
      'tiktok.com': 'TikTok',
      'pinterest.com': 'Pinterest',
      'reddit.com': 'Reddit',
      'medium.com': 'Medium',
      'scholar.google': 'Google Scholar',
      'researchgate.net': 'ResearchGate',
    };

    for (const [domain, platform] of Object.entries(platformMap)) {
      if (urlLower.includes(domain)) {
        return platform;
      }
    }

    return 'Web';
  }

  /**
   * Calculate base confidence score for a search result
   */
  private calculateBaseConfidence(item: any): number {
    let confidence = 50;

    // Domain-based confidence
    const url = item.url || '';
    const domain = new URL(url).hostname.toLowerCase();

    const domainScores: Record<string, number> = {
      'linkedin.com': 20,
      'github.com': 15,
      'twitter.com': 15,
      'x.com': 15,
      'facebook.com': 10,
      'instagram.com': 10,
    };

    for (const [domainKey, score] of Object.entries(domainScores)) {
      if (domain.includes(domainKey)) {
        confidence += score;
        break;
      }
    }

    // Content-based confidence
    if (item.snippet && item.snippet.length > 100) {
      confidence += 5;
    }
    if (item.name && item.name.length > 5) {
      confidence += 5;
    }

    return Math.min(confidence, 98);
  }

  /**
   * Build search tasks from parameters
   */
  static buildTasks(
    name?: string,
    email?: string,
    username?: string,
    stage: number = 1,
    previousResults: SearchResult[] = []
  ): SearchTask[] {
    const tasks: SearchTask[] = [];
    let priority = 0;

    // Name-based searches
    if (name) {
      const nameParts = name.split(' ');

      // Full name search
      tasks.push({
        type: 'web',
        query: `"${name}" profile`,
        priority: priority++,
        stage,
      });

      // Name + LinkedIn
      tasks.push({
        type: 'web',
        query: `"${name}" site:linkedin.com`,
        priority: priority++,
        stage,
      });

      // First + Last name variant
      if (nameParts.length >= 2) {
        tasks.push({
          type: 'web',
          query: `"${nameParts[0]} ${nameParts[nameParts.length - 1]}" profile`,
          priority: priority++,
          stage,
        });
      }
    }

    // Username searches
    if (username) {
      tasks.push({
        type: 'web',
        query: `"${username}" social media`,
        priority: priority++,
        stage,
      });

      tasks.push({
        type: 'web',
        query: `site:linkedin.com "${username}" OR site:twitter.com "${username}" OR site:github.com "${username}"`,
        priority: priority++,
        stage,
      });
    }

    // Email searches (more private, lower priority)
    if (email) {
      tasks.push({
        type: 'web',
        query: `"${email}" profile`,
        priority: priority++,
        stage,
      });
    }

    // Previous results refinement (stage > 1)
    if (stage > 1 && previousResults.length > 0) {
      const topPlatforms = this.getTopPlatforms(previousResults, 3);

      for (const platform of topPlatforms) {
        if (platform !== 'Web') {
          tasks.push({
            type: 'web',
            query: `${name || username || ''} ${platform}`,
            priority: priority++,
            stage,
          });
        }
      }
    }

    return tasks;
  }

  /**
   * Get top platforms from results
   */
  private static getTopPlatforms(results: SearchResult[], count: number): string[] {
    const platformCounts = results.reduce((acc, r) => {
      acc[r.platform] = (acc[r.platform] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(platformCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([platform]) => platform);
  }

  /**
   * Deduplicate results across all executions
   */
  static deduplicateResults(
    allResults: SearchResult[][]
  ): SearchResult[] {
    const seenUrls = new Set<string>();
    const deduplicated: SearchResult[] = [];

    for (const results of allResults) {
      for (const result of results) {
        if (!seenUrls.has(result.url)) {
          seenUrls.add(result.url);
          deduplicated.push(result);
        }
      }
    }

    return deduplicated.sort((a, b) => b.confidence - a.confidence);
  }
}

/**
 * Search Strategy
 */
export enum SearchStrategy {
  FAST = 'fast',
  BALANCED = 'balanced',
  THOROUGH = 'thorough',
}

/**
 * Get configuration for search strategy
 */
export function getStrategyConfig(strategy: SearchStrategy): {
  maxConcurrency: number;
  timeoutMs: number;
  batchSize: number;
  stages: number;
} {
  switch (strategy) {
    case SearchStrategy.FAST:
      return {
        maxConcurrency: 15,
        timeoutMs: 15000,
        batchSize: 10,
        stages: 2,
      };
    case SearchStrategy.BALANCED:
      return {
        maxConcurrency: 10,
        timeoutMs: 30000,
        batchSize: 5,
        stages: 5,
      };
    case SearchStrategy.THOROUGH:
      return {
        maxConcurrency: 8,
        timeoutMs: 60000,
        batchSize: 3,
        stages: 10,
      };
    default:
      return {
        maxConcurrency: 10,
        timeoutMs: 30000,
        batchSize: 5,
        stages: 5,
      };
  }
}
