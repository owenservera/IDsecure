import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const zai = await ZAI.create();
    const body = await request.json();
    const { email, phone, username } = body;

    const darkWebPrompt = `You are a Dark Web intelligence specialist. Generate a detailed (simulated for security) breach report for the following identifiers. 
    
Identifiers:
- Email: ${email || 'N/A'}
- Phone: ${phone || 'N/A'}
- Username: ${username || 'N/A'}

Analyze potential exposure in:
1. Historical data breaches (e.g., Collection #1, LinkedIn 2016, etc.)
2. Underground forum mentions.
3. Pastebin/Credential leaks.

Respond in JSON format:
{
  "summary": "Critical exposure found in 3 major breaches",
  "threatLevel": "high",
  "leaks": [
    {
      "source": "Exploit.in Dump",
      "date": "2024-02-15",
      "exposedData": ["Password Hash", "IP Address", "User Agent"],
      "severity": "critical"
    }
  ],
  "recommendations": ["Change primary email password", "Enable 2FA"]
}`;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a cybersecurity intelligence expert.' },
        { role: 'user', content: darkWebPrompt }
      ],
      temperature: 0.4,
    });

    const content = completion.choices[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const report = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'Deep-check failed' };

    return NextResponse.json({
      success: true,
      report
    });

  } catch (error) {
    return NextResponse.json({ success: false, error: 'Dark web analysis failed' }, { status: 500 });
  }
}
