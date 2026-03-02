import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export interface DetectedData {
  documentType?: string;
  names?: string[];
  dates?: string[];
  locations?: string[];
  organizations?: string[];
  phoneNumbers?: string[];
  emails?: string[];
  addresses?: string[];
  idNumbers?: string[];
  textContent?: string;
  qrCodes?: string[];
  barcodes?: string[];
  faces?: number;
  logos?: string[];
  distinctiveFeatures?: string[];
}

export interface ImageAnalysisResult {
  detectedData: DetectedData;
  confidence: number;
  summary: string;
  keyFindings: string[];
  actionItems?: string[];
}

interface AnalysisRequest {
  images: Array<{
    base64: string;
    filename?: string;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const zai = await ZAI.create();
    const body = await request.json() as AnalysisRequest;
    const { images } = body;

    if (!images || images.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No images provided'
      }, { status: 400 });
    }

    const analysisPromises = images.map(async (image) => {
      try {
        const analysisPrompt = `You are an expert document and image analyst. Analyze this image and extract ALL key data.

IMAGE ANALYSIS TASK:
Carefully examine the uploaded image and extract the following information:

1. DOCUMENT TYPE (if applicable):
   - ID card, passport, driver's license
   - Birth certificate, marriage certificate
   - Bank statement, utility bill
   - Medical record, prescription
   - Legal document, contract
   - Photo (portrait, group, event)
   - Screenshot (specify platform if visible)
   - Other (describe)

2. PERSONAL INFORMATION:
   - Full names (extract exactly as written)
   - Dates of birth, event dates, document dates
   - Phone numbers
   - Email addresses
   - Physical addresses

3. IDENTIFICATION NUMBERS:
   - ID numbers, passport numbers
   - Social security numbers
   - Driver's license numbers
   - Account numbers
   - Any other unique identifiers

4. ORGANIZATIONS & LOCATIONS:
   - Company names, employer names
   - School/university names
   - City, state, country names
   - Specific locations mentioned

5. VISUAL ELEMENTS:
   - Number of faces visible
   - Logos or brand names visible
   - QR codes or barcodes (note their presence)
   - Distinctive features (tattoos, landmarks, etc.)

6. TEXT CONTENT:
   - Extract ALL visible text verbatim
   - Preserve formatting where possible

7. KEY FINDINGS:
   - What important information does this image reveal?
   - Any red flags or notable discoveries?
   - How might this be useful for an investigation?

8. CONFIDENCE ASSESSMENT:
   - Rate your confidence in the extraction (0-100)
   - Note any unclear or ambiguous areas

Respond in JSON format ONLY:
{
  "detectedData": {
    "documentType": "string",
    "names": ["list of names"],
    "dates": ["list of dates"],
    "locations": ["list of locations"],
    "organizations": ["list of organizations"],
    "phoneNumbers": ["list of phone numbers"],
    "emails": ["list of emails"],
    "addresses": ["list of addresses"],
    "idNumbers": ["list of ID numbers"],
    "textContent": "full extracted text",
    "qrCodes": ["list of QR code content if readable"],
    "barcodes": ["list of barcode numbers if readable"],
    "faces": number,
    "logos": ["list of visible logos"],
    "distinctiveFeatures": ["list of notable features"]
  },
  "confidence": 0-100,
  "summary": "Brief 2-3 sentence summary of what this image reveals",
  "keyFindings": ["list of most important discoveries"],
  "actionItems": ["list of recommended follow-up actions"]
}

Be thorough and precise. Extract EVERY piece of readable information.`;

        const messages = [
          {
            role: 'user' as const,
            content: [
              { type: 'text' as const, text: analysisPrompt },
              {
                type: 'image_url' as const,
                image_url: {
                  url: `data:image/jpeg;base64,${image.base64}`
                }
              }
            ]
          }
        ];

        const completion = await zai.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: 'You are an expert document analyst and data extraction specialist. Always respond with valid JSON only. Extract all visible information accurately.'
            },
            ...messages
          ],
          temperature: 0.1,
        });

        const content = completion.choices[0]?.message?.content || '';
        
        // Extract JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No valid JSON in response');
        }

        const analysis: ImageAnalysisResult = JSON.parse(jsonMatch[0]);

        return {
          success: true,
          filename: image.filename || 'unknown',
          analysis
        };
      } catch (error) {
        console.error('Image analysis error:', error);
        return {
          success: false,
          filename: image.filename || 'unknown',
          error: error instanceof Error ? error.message : 'Analysis failed'
        };
      }
    });

    const results = await Promise.all(analysisPromises);

    const successfulAnalyses = results.filter(r => r.success);
    const failedAnalyses = results.filter(r => !r.success);

    // Generate cross-image insights if multiple images
    let crossImageInsights = null;
    if (successfulAnalyses.length > 1) {
      try {
        const insightsPrompt = `Analyze these ${successfulAnalyses.length} image analysis results and find connections:

${successfulAnalyses.map((r, i) => `
IMAGE ${i + 1} (${r.filename}):
- Document Type: ${r.analysis?.detectedData.documentType || 'Unknown'}
- Names: ${r.analysis?.detectedData.names?.join(', ') || 'None'}
- Locations: ${r.analysis?.detectedData.locations?.join(', ') || 'None'}
- Organizations: ${r.analysis?.detectedData.organizations?.join(', ') || 'None'}
- Key Findings: ${r.analysis?.keyFindings?.join('; ') || 'None'}
`).join('\n')}

Identify:
1. Common entities across images (same people, places, organizations)
2. Timeline connections (dates that relate images)
3. Relationship patterns
4. Contradictions or inconsistencies
5. Combined investigative value

JSON format:
{
  "commonEntities": {
    "people": ["names appearing in multiple images"],
    "locations": ["locations appearing multiple times"],
    "organizations": ["organizations mentioned across images"]
  },
  "timelineConnections": ["date-based connections between images"],
  "relationshipPatterns": ["observed patterns across images"],
  "contradictions": ["any inconsistencies found"],
  "combinedInsights": ["what we learn from looking at all images together"],
  "investigativeLeads": ["new leads discovered from cross-analysis"]
}`;

        const completion = await zai.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: 'You are an investigative analyst. Find connections across multiple pieces of evidence. Respond with valid JSON.'
            },
            {
              role: 'user',
              content: insightsPrompt
            }
          ],
          temperature: 0.2,
        });

        const content = completion.choices[0]?.message?.content || '';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          crossImageInsights = JSON.parse(jsonMatch[0]);
        }
      } catch (error) {
        console.error('Cross-image analysis error:', error);
      }
    }

    return NextResponse.json({
      success: true,
      totalImages: images.length,
      successfulAnalyses: successfulAnalyses.length,
      failedAnalyses: failedAnalyses.length,
      results: successfulAnalyses,
      errors: failedAnalyses,
      crossImageInsights,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Batch image analysis error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Batch analysis failed'
    }, { status: 500 });
  }
}
