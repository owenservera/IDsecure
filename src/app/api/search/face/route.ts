import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

interface FaceAnalysisResult {
  description: string;
  estimatedAge: string;
  gender: string;
  distinctiveFeatures: string[];
  suggestedSearchTerms: string[];
  confidence: number;
}

interface FaceSearchResponse {
  success: boolean;
  analysis: FaceAnalysisResult | null;
  searchResults: {
    platform: string;
    url: string;
    title: string;
    snippet: string;
    confidence: number;
  }[];
  timestamp: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<FaceSearchResponse>> {
  try {
    const body = await request.json();
    const { imageBase64, imageUrl } = body;

    // Validate that at least one image source is provided
    if (!imageBase64 && !imageUrl) {
      return NextResponse.json(
        {
          success: false,
          analysis: null,
          searchResults: [],
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const zai = await ZAI.create({
      apiKey: process.env.ZAI_API_KEY,
      baseURL: process.env.ZAI_API_URL
    });

    // Prepare image content for VLM
    const imageContent: { type: string; image_url?: { url: string }; text?: string }[] = [];
    
    if (imageUrl) {
      imageContent.push({
        type: 'image_url',
        image_url: { url: imageUrl },
      });
    } else if (imageBase64) {
      imageContent.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
      });
    }

    // Use VLM to analyze the face
    const visionCompletion = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'system',
          content: `You are an expert facial analysis AI assistant specialized in describing facial features for identification purposes. 
          Analyze the face in the image and provide:
          1. A detailed but respectful physical description
          2. Estimated age range
          3. Perceived gender
          4. Distinctive features that could help identify this person
          5. Suggested search terms that might help find this person online
          
          Always be respectful and professional in your analysis. Focus on objective, observable features.
          
          Respond in JSON format:
          {
            "description": "brief physical description",
            "estimatedAge": "age range like '25-35'",
            "gender": "perceived gender",
            "distinctiveFeatures": ["feature1", "feature2", ...],
            "suggestedSearchTerms": ["term1", "term2", ...]
          }`,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze the face in this image and provide identification details in JSON format.' },
            ...imageContent,
          ],
        },
      ],
      temperature: 0.3,
    });

    const analysisText = visionCompletion.choices[0]?.message?.content || '';
    
    // Parse the analysis JSON
    let analysis: FaceAnalysisResult = {
      description: '',
      estimatedAge: '',
      gender: '',
      distinctiveFeatures: [],
      suggestedSearchTerms: [],
      confidence: 0,
    };

    try {
      // Try to extract JSON from the response
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        analysis = {
          description: parsed.description || '',
          estimatedAge: parsed.estimatedAge || '',
          gender: parsed.gender || '',
          distinctiveFeatures: parsed.distinctiveFeatures || [],
          suggestedSearchTerms: parsed.suggestedSearchTerms || [],
          confidence: 75,
        };
      }
    } catch {
      console.error('Failed to parse face analysis JSON');
      analysis.description = analysisText;
      analysis.confidence = 50;
    }

    // Use the suggested search terms to find potential matches
    const searchResults: { platform: string; url: string; title: string; snippet: string; confidence: number }[] = [];

    // Perform web searches based on analysis
    const searchQueries = analysis.suggestedSearchTerms.slice(0, 2);
    
    for (const searchTerm of searchQueries) {
      try {
        const webSearchResult = await zai.functions.invoke('web_search', {
          query: `${searchTerm} profile photo social media`,
          num: 5,
        });

        if (Array.isArray(webSearchResult)) {
          for (const item of webSearchResult) {
            let platform = 'Web';
            const url = item.url?.toLowerCase() || '';
            
            if (url.includes('linkedin.com')) platform = 'LinkedIn';
            else if (url.includes('twitter.com') || url.includes('x.com')) platform = 'Twitter/X';
            else if (url.includes('facebook.com')) platform = 'Facebook';
            else if (url.includes('instagram.com')) platform = 'Instagram';
            else if (url.includes('github.com')) platform = 'GitHub';

            const existing = searchResults.find(r => r.url === item.url);
            if (!existing) {
              searchResults.push({
                platform,
                url: item.url,
                title: item.name || 'Unknown',
                snippet: item.snippet || '',
                confidence: 40 + Math.random() * 20, // Placeholder confidence
              });
            }
          }
        }
      } catch (searchError) {
        console.error('Face search error:', searchError);
      }
    }

    searchResults.sort((a, b) => b.confidence - a.confidence);

    return NextResponse.json({
      success: true,
      analysis,
      searchResults: searchResults.slice(0, 10),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Face search API error:', error);
    return NextResponse.json(
      {
        success: false,
        analysis: null,
        searchResults: [],
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
