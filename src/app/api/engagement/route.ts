import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

interface Profile {
  platform: string;
  url: string;
  title: string;
  snippet: string;
  confidence: number;
}

interface EngagementRequest {
  profiles: Profile[];
  searchQuery: {
    name?: string;
    email?: string;
    phone?: string;
    username?: string;
  };
  purpose?: string;
}

interface EngagementSuggestion {
  platform: string;
  strategy: string;
  approach: string;
  talkingPoints: string[];
  bestTimeToReach: string;
  priority: 'high' | 'medium' | 'low';
}

interface EngagementResponse {
  success: boolean;
  suggestions: EngagementSuggestion[];
  generalTips: string[];
  timestamp: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<EngagementResponse>> {
  try {
    const body: EngagementRequest = await request.json();
    const { profiles, searchQuery, purpose } = body;

    if (!profiles || profiles.length === 0) {
      return NextResponse.json(
        {
          success: false,
          suggestions: [],
          generalTips: ['No profiles provided for engagement analysis.'],
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const zai = await ZAI.create({
      apiKey: process.env.ZAI_API_KEY,
      baseURL: process.env.ZAI_API_URL
    });

    // Generate engagement strategies using LLM
    const engagementCompletion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are an expert social media engagement strategist and communications consultant.
          
          Based on the discovered social media profiles, provide personalized engagement strategies.
          
          For each profile, suggest:
          1. Best engagement approach (direct message, comment, share, etc.)
          2. Key talking points based on their profile content
          3. Best time to reach out based on platform activity patterns
          4. Priority level for engagement
          
          Also provide general tips for professional social media outreach.
          
          Respond in JSON format:
          {
            "suggestions": [
              {
                "platform": "platform name",
                "strategy": "engagement strategy description",
                "approach": "how to approach them",
                "talkingPoints": ["point1", "point2"],
                "bestTimeToReach": "timing recommendation",
                "priority": "high|medium|low"
              }
            ],
            "generalTips": ["tip1", "tip2", "tip3"]
          }`,
        },
        {
          role: 'user',
          content: `Generate engagement strategies for the following discovered profiles:

Search Query: ${JSON.stringify(searchQuery)}

Purpose of Engagement: ${purpose || 'Professional networking and connection'}

Discovered Profiles:
${profiles.slice(0, 10).map((p, i) => `
${i + 1}. ${p.title}
   Platform: ${p.platform}
   URL: ${p.url}
   Confidence: ${p.confidence}%
   Context: ${p.snippet}
`).join('\n')}

Provide comprehensive engagement strategies in JSON format.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 2500,
    });

    const responseText = engagementCompletion.choices[0]?.message?.content || '';
    
    let suggestions: EngagementSuggestion[] = [];
    let generalTips: string[] = [];

    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        suggestions = parsed.suggestions || [];
        generalTips = parsed.generalTips || [];
      }
    } catch {
      console.error('Failed to parse engagement suggestions JSON');
      // Fallback: create suggestions from profiles
      suggestions = profiles.slice(0, 5).map(p => ({
        platform: p.platform,
        strategy: 'Direct professional approach recommended',
        approach: 'Send a personalized connection request or message',
        talkingPoints: ['Mention shared interests', 'Be clear about your purpose'],
        bestTimeToReach: 'Tuesday-Thursday, 9 AM - 11 AM',
        priority: p.confidence > 70 ? 'high' : p.confidence > 50 ? 'medium' : 'low',
      }));
      generalTips = [
        'Always personalize your outreach messages',
        'Be clear about your intentions',
        'Respect privacy and respond professionally to rejections',
      ];
    }

    return NextResponse.json({
      success: true,
      suggestions,
      generalTips,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Engagement API error:', error);
    return NextResponse.json(
      {
        success: false,
        suggestions: [],
        generalTips: ['Unable to generate engagement suggestions at this time.'],
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
