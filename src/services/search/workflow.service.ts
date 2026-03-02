/**
 * Search Workflow Service - Orchestrates complex search operations
 * Integrates with job queue for background processing
 */

import { db } from '@/lib/db';
import {
  buildSearchQueries,
  executeQuery,
  deduplicateResults,
  calculateStatisticalAnalysis,
  persistInvestigation,
  type SearchQuery,
  type SearchOptions,
  type SearchResult as SearchResultType,
} from './search.service';
import ZAI from 'z-ai-web-dev-sdk';

export interface SearchWorkflowParams extends SearchQuery {
  hints?: any;
  powerMode?: boolean;
  stages?: number;
  aggressive?: boolean;
  aiRefinement?: boolean;
  confidenceThreshold?: number;
}

export interface SearchWorkflowResult {
  investigationId: string;
  results: SearchResultType[];
  stats: any;
  analysis: any;
}

/**
 * Execute complete search workflow
 * Can be called from job queue or directly
 */
export async function executeSearchWorkflow(
  params: SearchWorkflowParams
): Promise<SearchWorkflowResult> {
  const startTime = Date.now();
  const zai = await ZAI.create();
  
  const allResults: SearchResult[] = [];
  const maxIterations = Math.min(params.stages || 5, 10);
  let currentIteration = 1;

  // Build initial queries
  let activeQueries = buildSearchQueries(params, {
    stages: params.stages,
    aggressive: params.aggressive,
    deepScan: params.powerMode,
  });

  while (currentIteration <= maxIterations) {
    // Execute queries for this iteration
    const iterationResults: SearchResult[] = [];
    
    for (const query of activeQueries) {
      const results = await executeQuery(
        zai,
        query,
        currentIteration,
        params.confidenceThreshold || 40
      );
      iterationResults.push(...results);
    }

    // Deduplicate and add to all results
    const newResults = deduplicateResults(allResults, iterationResults);
    allResults.push(...newResults);

    // AI refinement for next iteration
    if (currentIteration < maxIterations && params.aiRefinement) {
      activeQueries = await generateNextQueries(zai, allResults, params);
    } else {
      break;
    }

    currentIteration++;
  }

  // Calculate statistics
  const stats = {
    totalQueries: 0,
    platformsSearched: [],
    crossReferences: 0,
    locationMatches: 0,
    highConfidenceMatches: 0,
    searchDuration: Date.now() - startTime,
    stagesCompleted: currentIteration,
    totalStages: maxIterations,
  };

  const analysis = calculateStatisticalAnalysis(allResults);

  // Persist to database
  const investigation = await persistInvestigation(params, allResults, stats);

  return {
    investigationId: investigation?.id || 'unknown',
    results: allResults.sort((a, b) => b.confidence - a.confidence),
    stats,
    analysis,
  };
}

/**
 * Generate next queries based on current results using AI
 */
async function generateNextQueries(
  zai: any,
  results: SearchResult[],
  params: SearchWorkflowParams
): Promise<string[]> {
  try {
    const prompt = `Analyze these search results and suggest ${3} new search queries to find more information.

Current results: ${JSON.stringify(results.slice(-5)).slice(0, 500)}
Subject: ${JSON.stringify({
      name: params.name,
      email: params.email,
      phone: params.phone,
      username: params.username,
    })}

Respond with a JSON array of search query strings.`;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are an expert OSINT investigator.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    });

    const content = completion.choices[0]?.message?.content || '';
    // Match JSON array - use simpler regex for compatibility
    const match = content.match(/\[[\s\S]*\]/);
    
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // Fallback to empty array
      }
    }
  } catch (error) {
    console.error('Failed to generate next queries:', error);
  }

  return [];
}

/**
 * Start async search job (via queue)
 */
export async function startAsyncSearch(params: SearchWorkflowParams): Promise<string> {
  const { jobQueueService } = await import('../queue/job-queue.service');
  
  const job = await jobQueueService.addSearchJob({
    type: 'search',
    payload: params,
    priority: params.powerMode ? 5 : 1,
  });

  return job.id;
}
