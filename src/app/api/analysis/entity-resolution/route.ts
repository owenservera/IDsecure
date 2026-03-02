import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

interface Profile {
  platform: string;
  url: string;
  title: string;
  snippet: string;
  confidence: number;
  location?: string;
  company?: string;
  profession?: string;
}

interface EntityMatch {
  entityId: string;
  profiles: Profile[];
  overallConfidence: number;
  crossReferences: number;
  riskFactors: string[];
  verifiedIdentity: boolean;
  confidenceBreakdown: {
    nameMatch: number;
    locationMatch: number;
    professionMatch: number;
    behavioralMatch: number;
    networkMatch: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const zai = await ZAI.create({
      apiKey: process.env.ZAI_API_KEY,
      baseURL: process.env.ZAI_API_URL
    });
    const body = await request.json();
    const { profiles, searchQuery } = body;

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ success: false, error: 'No profiles provided' });
    }

    // AI-powered entity resolution
    const resolutionPrompt = `You are an advanced entity resolution AI system. Analyze these social media profiles and determine if they belong to the same person.

Search Query: ${JSON.stringify(searchQuery)}

Profiles to analyze:
${profiles.map((p: Profile, i: number) => `
Profile ${i + 1}:
- Platform: ${p.platform}
- Title: ${p.title}
- URL: ${p.url}
- Snippet: ${p.snippet}
- Location: ${p.location || 'Unknown'}
- Company: ${p.company || 'Unknown'}
- Confidence: ${p.confidence}%
`).join('\n')}

Analyze and provide:
1. Entity groupings - which profiles likely belong to the same person
2. Confidence breakdown for each match type (name, location, profession, behavior, network)
3. Risk factors that might indicate fake/mismatched profiles
4. Verification recommendations

Respond in JSON format:
{
  "entities": [
    {
      "entityId": "entity_1",
      "profileIndices": [0, 2, 4],
      "overallConfidence": 85,
      "crossReferences": 3,
      "riskFactors": [],
      "verifiedIdentity": true,
      "confidenceBreakdown": {
        "nameMatch": 95,
        "locationMatch": 80,
        "professionMatch": 75,
        "behavioralMatch": 70,
        "networkMatch": 85
      }
    }
  ],
  "resolutionSummary": {
    "totalProfiles": 5,
    "uniqueEntities": 2,
    "highConfidenceMatches": 3,
    "requiresReview": 1
  },
  "recommendations": ["..."]
}`;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are an expert entity resolution AI that specializes in identity correlation across social media platforms. Always respond with valid JSON.' },
        { role: 'user', content: resolutionPrompt }
      ],
      temperature: 0.3,
    });

    let resolutionResult;
    try {
      const content = completion.choices[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        resolutionResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No valid JSON found');
      }
    } catch {
      // Fallback to basic resolution
      resolutionResult = {
        entities: profiles.map((p: Profile, i: number) => ({
          entityId: `entity_${i + 1}`,
          profileIndices: [i],
          overallConfidence: p.confidence,
          crossReferences: 0,
          riskFactors: [],
          verifiedIdentity: p.confidence >= 80,
          confidenceBreakdown: {
            nameMatch: p.confidence,
            locationMatch: p.location ? 70 : 40,
            professionMatch: p.company ? 65 : 35,
            behavioralMatch: 50,
            networkMatch: 45
          }
        })),
        resolutionSummary: {
          totalProfiles: profiles.length,
          uniqueEntities: profiles.length,
          highConfidenceMatches: profiles.filter((p: Profile) => p.confidence >= 80).length,
          requiresReview: profiles.filter((p: Profile) => p.confidence < 60).length
        },
        recommendations: ['Manual review recommended for low-confidence profiles']
      };
    }

    // Calculate advanced statistics
    const stats = {
      processingTime: Date.now(),
      profilesAnalyzed: profiles.length,
      entitiesResolved: resolutionResult.entities?.length || profiles.length,
      averageConfidence: profiles.reduce((sum: number, p: Profile) => sum + p.confidence, 0) / profiles.length,
      crossPlatformMatches: resolutionResult.entities?.filter((e: EntityMatch) => e.crossReferences > 0).length || 0
    };

    return NextResponse.json({
      success: true,
      resolution: resolutionResult,
      stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Entity resolution error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Entity resolution failed'
    }, { status: 500 });
  }
}
