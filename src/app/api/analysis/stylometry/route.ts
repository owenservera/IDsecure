import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const zai = await ZAI.create();
    const body = await request.json();
    const { profiles } = body;

    if (!profiles || profiles.length < 2) {
      return NextResponse.json({ 
        success: false, 
        error: 'At least two profiles are required for stylometry comparison' 
      });
    }

    const profilesText = profiles.map((p: any, i: number) => 
      `[Profile ${i+1}]\nPlatform: ${p.platform}\nText: ${p.snippet}`
    ).join('\n\n');

    const stylometryPrompt = `You are an expert stylometry and forensic linguistics analyst. Analyze the following profile snippets and descriptions to determine the likelihood that they were written by the same individual.

PROFILES:
${profilesText}

Analyze:
1. Punctuation patterns and idiosyncratic usage.
2. Sentence structure and complexity.
3. Vocabulary choices and slang usage.
4. Tone and sentiment consistency.

Provide a match matrix and a stylistic consistency score (0-100).

Respond in JSON format:
{
  "consistencyScore": 85,
  "matchMatrix": [
    { "profiles": [1, 2], "matchLikelihood": "High", "reasons": ["..."] }
  ],
  "linguisticMarkers": ["consistent use of Oxford comma", "frequent tech-slang"],
  "verdict": "Likely same author"
}`;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are an advanced linguistic forensics AI.' },
        { role: 'user', content: stylometryPrompt }
      ],
      temperature: 0.2,
    });

    const content = completion.choices[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'Analysis failed' };

    return NextResponse.json({
      success: true,
      analysis
    });

  } catch (error) {
    console.error('Stylometry analysis error:', error);
    return NextResponse.json(
      { success: false, error: 'Stylometry analysis failed' }, 
      { status: 500 }
    );
  }
}
