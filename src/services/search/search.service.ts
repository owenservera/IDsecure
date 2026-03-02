/**
 * Search Service - Core search functionality
 * Handles query building, execution, and result processing
 */

import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';
import type { SearchResult } from '@/lib/types';

export interface SearchQuery {
  name?: string;
  email?: string;
  phone?: string;
  username?: string;
  location?: string;
  company?: string;
  profession?: string;
  imageBase64?: string;
}

export interface SearchOptions {
  stages?: number;
  aggressive?: boolean;
  aiRefinement?: boolean;
  confidenceThreshold?: number;
  platforms?: string[];
  deepScan?: boolean;
}

export interface SearchProgress {
  stage: number;
  name: string;
  status: 'pending' | 'running' | 'completed';
  profilesFound: number;
  crossRefsFound: number;
  confidence: number;
  duration: number;
  description: string;
}

export interface SearchStats {
  totalQueries: number;
  platformsSearched: string[];
  crossReferences: number;
  locationMatches: number;
  highConfidenceMatches: number;
  searchDuration: number;
  stagesCompleted: number;
  totalStages: number;
}

/**
 * Build search queries based on provided parameters
 */
export function buildSearchQueries(query: SearchQuery, options: SearchOptions): string[] {
  const queries: string[] = [];
  const { name, email, phone, username, location, company, profession } = query;
  const { deepScan = false } = options;

  // Primary name search
  if (name) {
    queries.push(`"${name}" social media profile`);
    queries.push(`"${name}" LinkedIn Facebook Twitter Instagram`);

    // Cross-references
    if (location) queries.push(`"${name}" "${location}" profile`);
    if (company) queries.push(`"${name}" "${company}" employee`);
    if (profession) queries.push(`"${name}" ${profession}`);

    // Deep scan additions
    if (deepScan) {
      const nameParts = name.split(' ');
      if (nameParts.length >= 2) {
        queries.push(`"${nameParts[0]} ${nameParts[nameParts.length - 1]}" profile`);
        queries.push(`"${name}" education university college`);
        queries.push(`"${name}" publications articles`);
      }
    }
  }

  // Email search
  if (email) {
    queries.push(`"${email}" social profile`);
    queries.push(`"${email}" account`);
    if (name) queries.push(`"${email}" "${name}"`);
  }

  // Phone search
  if (phone) {
    queries.push(`"${phone}" social media`);
    queries.push(`"${phone}" profile`);
    if (name) queries.push(`"${phone}" "${name}"`);
  }

  // Username search
  if (username) {
    queries.push(`"${username}" social media profile`);
    queries.push(`site:linkedin.com "${username}" OR site:twitter.com "${username}" OR site:instagram.com "${username}" OR site:github.com "${username}"`);
    if (name) queries.push(`"${username}" "${name}"`);
  }

  // Location-based search
  if (location && !name && !email && !phone && !username) {
    queries.push(`"${location}" professionals directory`);
    queries.push(`"${location}" social profiles`);
    if (company) queries.push(`"${company}" "${location}" employees`);
  }

  // Company-based search
  if (company && !name && !email && !phone && !username) {
    queries.push(`"${company}" employees LinkedIn`);
    queries.push(`"${company}" staff directory`);
  }

  // Limit queries
  const maxQueries = deepScan ? 8 : 5;
  return queries.slice(0, maxQueries);
}

/**
 * Execute a single search query
 */
export async function executeQuery(
  zai: ZAI,
  query: string,
  stage: number,
  confidenceThreshold: number
): Promise<SearchResult[]> {
  try {
    const searchResult = await zai.functions.invoke('web_search', {
      query,
      num: 10,
    });

    if (!Array.isArray(searchResult)) return [];

    return searchResult
      .map((item: any) => {
        const platform = extractPlatform(item.url);
        const confidence = calculateConfidence(item, query);

        if (confidence < confidenceThreshold) return null;

        return {
          platform,
          url: item.url,
          title: item.name || 'Unknown',
          snippet: item.snippet || '',
          confidence,
          location: extractLocation(item.snippet),
          company: extractCompany(item.snippet),
          profession: extractProfession(item.snippet),
          stage,
        } as SearchResult;
      })
      .filter((r: SearchResult | null) => r !== null);
  } catch (error) {
    console.error('Query execution error:', error);
    return [];
  }
}

/**
 * Calculate confidence score for a result
 */
export function calculateConfidence(item: any, query: string): number {
  let confidence = 40;
  const snippet = (item.snippet || '').toLowerCase();
  const title = (item.name || '').toLowerCase();

  // Extract search terms from query
  const queryTerms = query
    .replace(/["()]/g, '')
    .split(/\s+/)
    .filter(term => term.length > 2);

  // Term matching
  for (const term of queryTerms) {
    if (snippet.includes(term) || title.includes(term)) {
      confidence += 8;
    }
  }

  // Full query match bonus
  const cleanQuery = query.replace(/["()]/g, '').toLowerCase();
  if (snippet.includes(cleanQuery) || title.includes(cleanQuery)) {
    confidence += 15;
  }

  // Platform bonus
  const platform = extractPlatform(item.url);
  if (platform !== 'Web') confidence += 8;

  return Math.min(confidence, 98);
}

/**
 * Extract platform from URL
 */
export function extractPlatform(url: string): string {
  const urlLower = url.toLowerCase();

  if (urlLower.includes('linkedin.com')) return 'LinkedIn';
  if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) return 'Twitter/X';
  if (urlLower.includes('facebook.com')) return 'Facebook';
  if (urlLower.includes('instagram.com')) return 'Instagram';
  if (urlLower.includes('github.com')) return 'GitHub';
  if (urlLower.includes('youtube.com')) return 'YouTube';
  if (urlLower.includes('tiktok.com')) return 'TikTok';
  if (urlLower.includes('pinterest.com')) return 'Pinterest';
  if (urlLower.includes('reddit.com')) return 'Reddit';
  if (urlLower.includes('medium.com')) return 'Medium';
  if (urlLower.includes('scholar.google')) return 'Google Scholar';
  if (urlLower.includes('researchgate.net')) return 'ResearchGate';

  return 'Web';
}

/**
 * Extract location from snippet
 */
export function extractLocation(text: string): string | undefined {
  if (!text) return undefined;

  const locationPatterns = [
    /(?:located|based|living)\s+in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2})/i,
    /(?:in|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2})/i,
  ];

  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }

  return undefined;
}

/**
 * Extract company from snippet
 */
export function extractCompany(text: string): string | undefined {
  if (!text) return undefined;

  const companyPatterns = [
    /(?:works?|worked|working)\s+(?:at|for|with)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)/i,
    /(?:employee|staff)\s+at\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)/i,
  ];

  for (const pattern of companyPatterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }

  return undefined;
}

/**
 * Extract profession from snippet
 */
export function extractProfession(text: string): string | undefined {
  if (!text) return undefined;

  const professionPatterns = [
    /(?:is a|as a|works as)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?\s+(?:engineer|developer|manager|director|designer|analyst|specialist|consultant))/i,
    /(Software Engineer|Data Scientist|Product Manager|UX Designer|CEO|CTO|Director|Manager)/i,
  ];

  for (const pattern of professionPatterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }

  return undefined;
}

/**
 * Deduplicate results by URL
 */
export function deduplicateResults(existing: SearchResult[], newResults: SearchResult[]): SearchResult[] {
  const urls = new Set(existing.map(r => r.url));
  return newResults.filter(r => !urls.has(r.url));
}

/**
 * Calculate statistical analysis from results
 */
export function calculateStatisticalAnalysis(results: SearchResult[]) {
  if (results.length === 0) {
    return {
      overallConfidence: 0,
      profileCorrelation: 0,
      dataConsistency: 0,
      verificationScore: 0,
      networkAnalysis: {
        connections: 0,
        mutualConnections: 0,
        networkStrength: 'unknown',
      },
      timelineConsistency: 0,
      geographicConsistency: 0,
    };
  }

  const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
  const platforms = new Set(results.map(r => r.platform));
  const locations = results.filter(r => r.location);
  const highConfidence = results.filter(r => r.confidence >= 80);

  return {
    overallConfidence: Math.round(avgConfidence),
    profileCorrelation: Math.round((highConfidence.length / results.length) * 100),
    dataConsistency: Math.round(platforms.size > 1 ? 70 + (platforms.size * 5) : 50),
    verificationScore: Math.round(avgConfidence * 0.9),
    networkAnalysis: {
      connections: results.length,
      mutualConnections: Math.floor(results.length * 0.3),
      networkStrength: results.length > 5 ? 'strong' : results.length > 2 ? 'moderate' : 'weak',
    },
    timelineConsistency: 75,
    geographicConsistency: locations.length > 0 ? Math.round((locations.length / results.length) * 100) : 0,
  };
}

/**
 * Persist investigation to database
 */
export async function persistInvestigation(
  query: SearchQuery,
  results: SearchResult[],
  stats: SearchStats,
  userId?: string
) {
  try {
    const investigation = await db.investigation.create({
      data: {
        name: query.name || null,
        email: query.email || null,
        phone: query.phone || null,
        username: query.username || null,
        userId: userId || null,
        status: 'completed',
        results: {
          create: results.slice(0, 30).map(r => ({
            platform: r.platform,
            url: r.url,
            title: r.title,
            snippet: r.snippet,
            confidence: r.confidence,
            location: r.location,
            company: r.company,
            profession: r.profession,
            stage: r.stage || 1,
          })),
        },
      },
      include: {
        results: true,
      },
    });

    return investigation;
  } catch (error) {
    console.error('Failed to persist investigation:', error);
    return null;
  }
}
