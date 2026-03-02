import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

interface SearchResult {
  platform: string;
  url: string;
  title: string;
  snippet: string;
  profileImage?: string;
  location?: string;
  profession?: string;
  company?: string;
  education?: string;
  connections?: string;
  lastActive?: string;
  confidence: number;
}

interface SearchStats {
  totalQueries: number;
  platformsSearched: string[];
  crossReferences: number;
  locationMatches: number;
  highConfidenceMatches: number;
  searchDuration: number;
}

interface DeepScanResult {
  category: string;
  findings: string[];
  confidence: number;
  sources: string[];
}

interface SearchResponse {
  success: boolean;
  results: SearchResult[];
  stats: SearchStats;
  deepScanResults?: DeepScanResult[];
  query: Record<string, unknown>;
  timestamp: string;
  fromCache?: boolean;
}

export async function POST(request: NextRequest): Promise<NextResponse<SearchResponse>> {
  const startTime = Date.now();

  try {
    // Import cache manager and strategies
    const { cache, CacheTTL } = await import('@/lib/cache/redis-client');
    const { CacheKeys, SearchCacheStrategy } = await import('@/lib/cache/cache-keys');

    const body = await request.json();
    const {
      name,
      email,
      phone,
      username,
      location,
      company,
      profession,
      crossReference = true,
      deepScan = false,
      confidenceThreshold = 50,
      platforms: selectedPlatforms = ['all'],
    } = body;

    // Validate that at least one search parameter is provided
    const hasInput = name || email || phone || username || location || company || profession;
    if (!hasInput) {
      return NextResponse.json(
        {
          success: false,
          results: [],
          stats: {
            totalQueries: 0,
            platformsSearched: [],
            crossReferences: 0,
            locationMatches: 0,
            highConfidenceMatches: 0,
            searchDuration: 0,
          },
          query: {},
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Generate cache key for search parameters
    const cacheKey = CacheKeys.search({
      name,
      email,
      phone,
      username,
      location,
      company,
      profession,
      crossReference,
      deepScan,
      confidenceThreshold,
      platforms: selectedPlatforms,
    });

    // Check cache for existing results
    const searchCache = new SearchCacheStrategy(cacheKey);
    const cached = await searchCache.getWithMetadata();

    if (cached) {
      console.log(`✅ Cache HIT for search: ${cacheKey}`);
      const stats: SearchStats = {
        totalQueries: 0,
        platformsSearched: [],
        crossReferences: 0,
        locationMatches: 0,
        highConfidenceMatches: cached.results.filter(r => r.confidence >= 80).length,
        searchDuration: 0,
      };

      return NextResponse.json({
        success: true,
        results: cached.results,
        stats,
        query: { name, email, phone, username, location, company, profession },
        timestamp: new Date().toISOString(),
        fromCache: true,
      });
    }

    console.log(`❌ Cache MISS for search: ${cacheKey}`);

    const zai = await ZAI.create();
    const results: SearchResult[] = [];
    let totalQueries = 0;
    const platformsSearchedSet = new Set<string>();
    let crossRefCount = 0;
    let locationMatches = 0;

    // Build search queries based on provided parameters
    const searchQueries: string[] = [];

    // Primary name search
    if (name) {
      searchQueries.push(`"${name}" social media profile`);
      searchQueries.push(`"${name}" LinkedIn Facebook Twitter Instagram`);

      // Name + Location cross-reference
      if (location && crossReference) {
        searchQueries.push(`"${name}" "${location}" profile`);
        crossRefCount++;
      }

      // Name + Company cross-reference
      if (company && crossReference) {
        searchQueries.push(`"${name}" "${company}" employee`);
        crossRefCount++;
      }

      // Name + Profession cross-reference
      if (profession && crossReference) {
        searchQueries.push(`"${name}" ${profession}`);
        crossRefCount++;
      }
    }

    // Email search
    if (email) {
      searchQueries.push(`"${email}" social profile`);
      searchQueries.push(`"${email}" account`);

      // Email + Name cross-reference
      if (name && crossReference) {
        searchQueries.push(`"${email}" "${name}"`);
        crossRefCount++;
      }
    }

    // Phone search
    if (phone) {
      searchQueries.push(`"${phone}" social media`);
      searchQueries.push(`"${phone}" profile`);

      // Phone + Name cross-reference
      if (name && crossReference) {
        searchQueries.push(`"${phone}" "${name}"`);
        crossRefCount++;
      }
    }

    // Username search
    if (username) {
      searchQueries.push(`"${username}" social media profile`);
      searchQueries.push(`site:linkedin.com "${username}" OR site:twitter.com "${username}" OR site:instagram.com "${username}" OR site:github.com "${username}"`);

      // Username + Name cross-reference
      if (name && crossReference) {
        searchQueries.push(`"${username}" "${name}"`);
        crossRefCount++;
      }
    }

    // Location-based search
    if (location) {
      if (!name && !email && !phone && !username) {
        // Pure location search
        searchQueries.push(`"${location}" professionals directory`);
        searchQueries.push(`"${location}" social profiles`);
      }

      // Location + Company cross-reference
      if (company && crossReference && !name) {
        searchQueries.push(`"${company}" "${location}" employees`);
        crossRefCount++;
      }
    }

    // Company-based search
    if (company && !name && !email && !phone && !username) {
      searchQueries.push(`"${company}" employees LinkedIn`);
      searchQueries.push(`"${company}" staff directory`);
    }

    // Deep scan - add more thorough queries
    if (deepScan) {
      if (name) {
        // Search for variations
        const nameParts = name.split(' ');
        if (nameParts.length >= 2) {
          searchQueries.push(`"${nameParts[0]} ${nameParts[nameParts.length - 1]}" profile`);
          searchQueries.push(`"${name}" education university college`);
          searchQueries.push(`"${name}" publications articles`);
        }
      }

      // Professional network searches
      if (profession) {
        searchQueries.push(`"${profession}" "LinkedIn" "profile"`);
      }

      // Academic/Research searches
      if (name) {
        searchQueries.push(`"${name}" research publications Google Scholar`);
      }
    }

    // Limit queries to avoid rate limiting (more if deep scan)
    const maxQueries = deepScan ? 8 : 5;
    const queriesToExecute = searchQueries.slice(0, maxQueries);

    // Execute web searches
    for (const query of queriesToExecute) {
      try {
        totalQueries++;
        const searchResult = await zai.functions.invoke('web_search', {
          query,
          num: deepScan ? 15 : 10,
        });

        if (Array.isArray(searchResult)) {
          for (const item of searchResult) {
            // Determine platform from URL
            let platform = 'Web';
            const url = item.url?.toLowerCase() || '';

            if (url.includes('linkedin.com')) platform = 'LinkedIn';
            else if (url.includes('twitter.com') || url.includes('x.com')) platform = 'Twitter/X';
            else if (url.includes('facebook.com')) platform = 'Facebook';
            else if (url.includes('instagram.com')) platform = 'Instagram';
            else if (url.includes('github.com')) platform = 'GitHub';
            else if (url.includes('youtube.com')) platform = 'YouTube';
            else if (url.includes('tiktok.com')) platform = 'TikTok';
            else if (url.includes('pinterest.com')) platform = 'Pinterest';
            else if (url.includes('reddit.com')) platform = 'Reddit';
            else if (url.includes('medium.com')) platform = 'Medium';
            else if (url.includes('scholar.google')) platform = 'Google Scholar';
            else if (url.includes('researchgate.net')) platform = 'ResearchGate';

            // Filter by selected platforms
            if (!selectedPlatforms.includes('all') && !selectedPlatforms.includes(platform)) {
              continue;
            }

            platformsSearchedSet.add(platform);

            // Calculate confidence score
            let confidence = 40;
            const snippet = (item.snippet || '').toLowerCase();
            const title = (item.name || '').toLowerCase();

            // Name matching
            if (name) {
              const nameParts = name.toLowerCase().split(' ');
              for (const part of nameParts) {
                if (part.length > 2 && (snippet.includes(part) || title.includes(part))) {
                  confidence += 12;
                }
              }
              // Full name match bonus
              if (snippet.includes(name.toLowerCase()) || title.includes(name.toLowerCase())) {
                confidence += 15;
              }
            }

            // Email matching
            if (email && (snippet.includes(email.toLowerCase()) || title.includes(email.toLowerCase()))) {
              confidence += 25;
            }

            // Phone matching
            if (phone) {
              const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
              if (snippet.includes(cleanPhone) || title.includes(cleanPhone) ||
                  snippet.includes(phone) || title.includes(phone)) {
                confidence += 25;
              }
            }

            // Username matching
            if (username && (snippet.includes(username.toLowerCase()) || title.includes(username.toLowerCase()))) {
              confidence += 20;
            }

            // Location matching
            if (location && (snippet.includes(location.toLowerCase()) || title.includes(location.toLowerCase()))) {
              confidence += 10;
              locationMatches++;
            }

            // Company matching
            if (company && (snippet.includes(company.toLowerCase()) || title.includes(company.toLowerCase()))) {
              confidence += 10;
            }

            // Profession matching
            if (profession && (snippet.includes(profession.toLowerCase()) || title.includes(profession.toLowerCase()))) {
              confidence += 8;
            }

            // Platform bonus (social media is more relevant)
            if (platform !== 'Web') confidence += 8;

            confidence = Math.min(confidence, 98);

            // Extract additional info from snippet
            const extractedLocation = extractLocation(snippet);
            const extractedCompany = extractCompany(snippet);
            const extractedProfession = extractProfession(snippet);

            // Check confidence threshold
            if (confidence < confidenceThreshold) continue;

            // Avoid duplicates
            const existingResult = results.find(r => r.url === item.url);
            if (!existingResult) {
              results.push({
                platform,
                url: item.url,
                title: item.name || 'Unknown',
                snippet: item.snippet || '',
                confidence,
                location: extractedLocation || (location && snippet.includes(location.toLowerCase()) ? location : undefined),
                company: extractedCompany || (company && snippet.includes(company.toLowerCase()) ? company : undefined),
                profession: extractedProfession || (profession && snippet.includes(profession.toLowerCase()) ? profession : undefined),
              });
            }
          }
        }
      } catch (searchError) {
        console.error('Search error for query:', query, searchError);
      }
    }

    // Sort results by confidence
    results.sort((a, b) => b.confidence - a.confidence);

    // Prepare stats
    const stats: SearchStats = {
      totalQueries,
      platformsSearched: Array.from(platformsSearchedSet),
      crossReferences: crossRefCount,
      locationMatches,
      highConfidenceMatches: results.filter(r => r.confidence >= 80).length,
      searchDuration: Date.now() - startTime,
    };

    // Deep scan analysis
    let deepScanResults: DeepScanResult[] = [];
    if (deepScan && results.length > 0) {
      deepScanResults = await performDeepScan(zai, results, { name, company, location, profession });
    }

    // Return top results (more if deep scan)
    const maxResults = deepScan ? 30 : 20;
    const topResults = results.slice(0, maxResults);

    // Cache the results for future searches
    await searchCache.setResults(topResults, CacheTTL.SEARCH);
    console.log(`✅ Cached ${topResults.length} results for key: ${cacheKey}`);

    return NextResponse.json({
      success: true,
      results: topResults,
      stats,
      deepScanResults,
      query: { name, email, phone, username, location, company, profession },
      timestamp: new Date().toISOString(),
      fromCache: false,
    });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      {
        success: false,
        results: [],
        stats: {
          totalQueries: 0,
          platformsSearched: [],
          crossReferences: 0,
          locationMatches: 0,
          highConfidenceMatches: 0,
          searchDuration: Date.now() - startTime,
        },
        query: {},
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Helper function to extract location from snippet
function extractLocation(text: string): string | undefined {
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

// Helper function to extract company from snippet
function extractCompany(text: string): string | undefined {
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

// Helper function to extract profession from snippet
function extractProfession(text: string): string | undefined {
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

// Deep scan analysis using AI
async function performDeepScan(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  results: SearchResult[],
  query: Record<string, unknown>
): Promise<DeepScanResult[]> {
  try {
    const resultsSummary = results.slice(0, 10).map(r =>
      `${r.title} (${r.platform}): ${r.snippet.slice(0, 200)}`
    ).join('\n');

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are an expert OSINT analyst. Analyze the search results and extract deep insights.

Return a JSON array of analysis categories with findings:
[
  {
    "category": "Professional Background",
    "findings": ["finding1", "finding2"],
    "confidence": 85,
    "sources": ["LinkedIn", "Company Website"]
  },
  {
    "category": "Geographic Presence",
    "findings": ["finding1"],
    "confidence": 70,
    "sources": ["Facebook", "Instagram"]
  },
  {
    "category": "Digital Footprint",
    "findings": ["finding1"],
    "confidence": 90,
    "sources": ["GitHub", "Twitter"]
  }
]

Focus on: Professional Background, Geographic Presence, Digital Footprint, Network Analysis, Content Themes.`,
        },
        {
          role: 'user',
          content: `Analyze these search results for: ${JSON.stringify(query)}

Results:
${resultsSummary}

Provide deep scan analysis as JSON array.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    });

    const responseText = completion.choices[0]?.message?.content || '';
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('Deep scan error:', error);
  }

  return [];
}
