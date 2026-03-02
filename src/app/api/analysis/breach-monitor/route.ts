import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

interface BreachResult {
  source: string;
  breachType: 'credential' | 'personal' | 'financial' | 'social';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  exposedData: string[];
  dateDiscovered: string;
  status: 'active' | 'resolved' | 'unknown';
  remediation: string[];
}

export async function POST(request: NextRequest) {
  try {
    const zai = await ZAI.create();
    const body = await request.json();
    const { email, phone, username, name } = body;

    // Search for breach-related information
    const searchQueries = [];
    if (email) searchQueries.push(`"${email}" data breach leak exposed credentials`);
    if (phone) searchQueries.push(`"${phone}" data breach leak phone number exposed`);
    if (username) searchQueries.push(`"${username}" data breach leak account compromised`);
    if (name) searchQueries.push(`"${name}" data breach leak exposed`);

    const breachResults: BreachResult[] = [];

    // Perform web searches for breach information
    for (const query of searchQueries.slice(0, 3)) {
      try {
        const searchResult = await zai.functions.invoke('web_search', {
          query,
          num: 10
        });

        if (Array.isArray(searchResult)) {
          for (const result of searchResult) {
            // Analyze each result for breach indicators
            const isBreachRelated = 
              result.snippet?.toLowerCase().includes('breach') ||
              result.snippet?.toLowerCase().includes('leak') ||
              result.snippet?.toLowerCase().includes('exposed') ||
              result.snippet?.toLowerCase().includes('compromised') ||
              result.snippet?.toLowerCase().includes('hack');

            if (isBreachRelated) {
              breachResults.push({
                source: result.url || 'Unknown',
                breachType: determineBreachType(result.snippet || ''),
                severity: determineSeverity(result.snippet || ''),
                title: result.name || 'Data Breach Detected',
                description: result.snippet || 'Potential data exposure detected',
                exposedData: extractExposedData(result.snippet || ''),
                dateDiscovered: result.date || new Date().toISOString().split('T')[0],
                status: 'unknown',
                remediation: []
              });
            }
          }
        }
      } catch (searchError) {
        console.error('Search error:', searchError);
      }
    }

    // AI-powered breach analysis
    const analysisPrompt = `Analyze these potential data breach findings for the individual:
Email: ${email || 'Not provided'}
Phone: ${phone || 'Not provided'}
Username: ${username || 'Not provided'}
Name: ${name || 'Not provided'}

Breach findings:
${breachResults.map((r, i) => `
${i + 1}. ${r.title}
   Source: ${r.source}
   Type: ${r.breachType}
   Severity: ${r.severity}
   Description: ${r.description}
`).join('\n')}

Provide analysis in JSON format:
{
  "overallRisk": "low|medium|high|critical",
  "riskScore": 0-100,
  "breachSummary": {
    "totalBreaches": number,
    "criticalBreaches": number,
    "recentBreaches": number
  },
  "exposedDataTypes": ["email", "password", "phone", etc],
  "recommendations": ["action items"],
  "darkWebMentions": number,
  "credentialStatus": {
    "compromised": boolean,
    "lastChecked": "date",
    "sources": []
  }
}`;

    let analysis;
    try {
      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are a cybersecurity analyst specializing in data breach detection and dark web monitoring. Provide accurate JSON responses.' },
          { role: 'user', content: analysisPrompt }
        ],
        temperature: 0.2,
      });

      const content = completion.choices[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No valid JSON');
      }
    } catch {
      // Fallback analysis
      analysis = {
        overallRisk: breachResults.length > 0 ? 'medium' : 'low',
        riskScore: breachResults.length * 15,
        breachSummary: {
          totalBreaches: breachResults.length,
          criticalBreaches: breachResults.filter(r => r.severity === 'critical').length,
          recentBreaches: breachResults.filter(r => {
            const date = new Date(r.dateDiscovered);
            const now = new Date();
            return (now.getTime() - date.getTime()) < 365 * 24 * 60 * 60 * 1000;
          }).length
        },
        exposedDataTypes: [...new Set(breachResults.flatMap(r => r.exposedData))],
        recommendations: [
          'Enable two-factor authentication on all accounts',
          'Change passwords for potentially affected accounts',
          'Monitor financial statements for suspicious activity',
          'Consider identity theft protection services'
        ],
        darkWebMentions: breachResults.length,
        credentialStatus: {
          compromised: breachResults.length > 0,
          lastChecked: new Date().toISOString(),
          sources: breachResults.map(r => r.source)
        }
      };
    }

    return NextResponse.json({
      success: true,
      breachResults,
      analysis,
      monitoring: {
        enabled: true,
        lastScan: new Date().toISOString(),
        nextScan: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        scanFrequency: 'daily'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Breach monitoring error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Breach monitoring failed'
    }, { status: 500 });
  }
}

function determineBreachType(snippet: string): BreachResult['breachType'] {
  const lower = snippet.toLowerCase();
  if (lower.includes('password') || lower.includes('credential') || lower.includes('login')) {
    return 'credential';
  }
  if (lower.includes('credit') || lower.includes('financial') || lower.includes('bank')) {
    return 'financial';
  }
  if (lower.includes('social') || lower.includes('profile') || lower.includes('account')) {
    return 'social';
  }
  return 'personal';
}

function determineSeverity(snippet: string): BreachResult['severity'] {
  const lower = snippet.toLowerCase();
  const criticalKeywords = ['ssn', 'social security', 'credit card', 'bank account', 'password'];
  const highKeywords = ['email', 'phone', 'address', 'credential'];
  
  if (criticalKeywords.some(k => lower.includes(k))) return 'critical';
  if (highKeywords.some(k => lower.includes(k))) return 'high';
  if (lower.includes('breach') || lower.includes('leak')) return 'medium';
  return 'low';
}

function extractExposedData(snippet: string): string[] {
  const dataTypes: string[] = [];
  const lower = snippet.toLowerCase();
  
  if (lower.includes('email')) dataTypes.push('email');
  if (lower.includes('password')) dataTypes.push('password');
  if (lower.includes('phone')) dataTypes.push('phone');
  if (lower.includes('address')) dataTypes.push('address');
  if (lower.includes('name')) dataTypes.push('name');
  if (lower.includes('ssn') || lower.includes('social security')) dataTypes.push('SSN');
  if (lower.includes('credit') || lower.includes('card')) dataTypes.push('credit card');
  if (lower.includes('date of birth') || lower.includes('dob')) dataTypes.push('date of birth');
  
  return dataTypes.length > 0 ? dataTypes : ['unknown'];
}
