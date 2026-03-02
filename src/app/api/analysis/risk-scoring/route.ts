import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

interface RiskFactor {
  category: 'identity' | 'behavioral' | 'network' | 'content' | 'temporal';
  factor: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  description: string;
  mitigation: string;
}

interface ThreatIndicator {
  type: string;
  confidence: number;
  source: string;
  details: string;
  recommendedAction: string;
}

export async function POST(request: NextRequest) {
  try {
    const zai = await ZAI.create();
    const body = await request.json();
    const { profiles, searchQuery, breachResults, entityResolution } = body;

    const riskFactors: RiskFactor[] = [];
    const threatIndicators: ThreatIndicator[] = [];

    // Identity-based risk analysis
    if (profiles && Array.isArray(profiles)) {
      // Check for profile inconsistencies
      const locations = profiles.map((p: { location?: string }) => p.location).filter(Boolean);
      const uniqueLocations = [...new Set(locations)];
      if (uniqueLocations.length > 3) {
        riskFactors.push({
          category: 'identity',
          factor: 'Location Inconsistency',
          severity: 'medium',
          score: 25,
          description: `Multiple location claims: ${uniqueLocations.slice(0, 5).join(', ')}`,
          mitigation: 'Verify current location through recent activity'
        });
      }

      // Check for unverified high-confidence profiles
      const highConfidenceUnverified = profiles.filter(
        (p: { confidence: number; verified?: boolean }) => p.confidence >= 80 && !p.verified
      );
      if (highConfidenceUnverified.length > 0) {
        riskFactors.push({
          category: 'identity',
          factor: 'Unverified High-Confidence Profiles',
          severity: 'medium',
          score: 20,
          description: `${highConfidenceUnverified.length} profiles with high confidence but no verification`,
          mitigation: 'Cross-reference with known authentic sources'
        });
      }

      // Platform-specific risk analysis
      const platformCount = new Set(profiles.map((p: { platform: string }) => p.platform)).size;
      if (platformCount < 2) {
        riskFactors.push({
          category: 'network',
          factor: 'Limited Platform Presence',
          severity: 'low',
          score: 10,
          description: 'Profile only found on limited platforms',
          mitigation: 'Expand search to additional platforms'
        });
      }

      // Check for suspicious profile patterns
      const avgConfidence = profiles.reduce((sum: number, p: { confidence: number }) => sum + p.confidence, 0) / profiles.length;
      if (avgConfidence < 50) {
        riskFactors.push({
          category: 'identity',
          factor: 'Low Overall Confidence',
          severity: 'high',
          score: 35,
          description: `Average confidence score of ${avgConfidence.toFixed(1)}% indicates uncertain identity`,
          mitigation: 'Gather additional identifying information'
        });
      }
    }

    // Breach-based risk factors
    if (breachResults && breachResults.breachResults?.length > 0) {
      const criticalBreaches = breachResults.breachResults.filter(
        (b: { severity: string }) => b.severity === 'critical'
      );
      if (criticalBreaches.length > 0) {
        riskFactors.push({
          category: 'identity',
          factor: 'Critical Data Breaches',
          severity: 'critical',
          score: 50,
          description: `${criticalBreaches.length} critical data breach exposures detected`,
          mitigation: 'Immediate credential rotation recommended'
        });
        threatIndicators.push({
          type: 'credential_exposure',
          confidence: 90,
          source: 'breach_monitoring',
          details: 'Personal credentials found in known data breaches',
          recommendedAction: 'Change all passwords and enable 2FA'
        });
      }
    }

    // Behavioral analysis
    const behavioralPrompt = `Analyze the behavioral risk factors for this individual's online presence:

Search Query: ${JSON.stringify(searchQuery)}
Number of Profiles: ${profiles?.length || 0}
Average Confidence: ${profiles ? (profiles.reduce((sum: number, p: { confidence: number }) => sum + p.confidence, 0) / profiles.length).toFixed(1) : 0}%
Entity Resolution Status: ${entityResolution ? 'Completed' : 'Pending'}

Identify potential behavioral risk factors:
1. Activity patterns (active/dormant/inconsistent)
2. Profile consistency across platforms
3. Information disclosure levels
4. Privacy posture
5. Potential impersonation indicators

Respond in JSON format:
{
  "behavioralRisks": [
    {
      "factor": "name",
      "severity": "low|medium|high",
      "score": 0-50,
      "description": "description",
      "mitigation": "recommendation"
    }
  ],
  "threatIndicators": [
    {
      "type": "indicator_type",
      "confidence": 0-100,
      "details": "description",
      "recommendedAction": "action"
    }
  ],
  "overallAssessment": {
    "riskLevel": "low|medium|high|critical",
    "confidenceScore": 0-100,
    "primaryConcerns": ["list"],
    "recommendedActions": ["list"]
  }
}`;

    let behavioralAnalysis;
    try {
      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are a threat intelligence analyst specializing in social media risk assessment. Provide accurate JSON risk assessments.' },
          { role: 'user', content: behavioralPrompt }
        ],
        temperature: 0.2,
      });

      const content = completion.choices[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        behavioralAnalysis = JSON.parse(jsonMatch[0]);
        // Add behavioral risks to main risk factors
        if (behavioralAnalysis.behavioralRisks) {
          riskFactors.push(...behavioralAnalysis.behavioralRisks.map((r: RiskFactor) => ({
            ...r,
            category: 'behavioral' as const
          })));
        }
        if (behavioralAnalysis.threatIndicators) {
          threatIndicators.push(...behavioralAnalysis.threatIndicators);
        }
      }
    } catch {
      // Fallback behavioral analysis
      riskFactors.push({
        category: 'behavioral',
        factor: 'Standard Online Presence',
        severity: 'low',
        score: 5,
        description: 'Normal behavioral patterns detected',
        mitigation: 'Continue monitoring'
      });
      behavioralAnalysis = {
        overallAssessment: {
          riskLevel: 'low',
          confidenceScore: 70,
          primaryConcerns: [],
          recommendedActions: ['Regular monitoring recommended']
        }
      };
    }

    // Calculate overall risk score
    const totalRiskScore = Math.min(100, riskFactors.reduce((sum, r) => sum + r.score, 0));
    const overallRiskLevel = 
      totalRiskScore >= 75 ? 'critical' :
      totalRiskScore >= 50 ? 'high' :
      totalRiskScore >= 25 ? 'medium' : 'low';

    // Generate credibility score
    const credibilityScore = Math.max(0, 100 - totalRiskScore);

    return NextResponse.json({
      success: true,
      riskAssessment: {
        overallRiskLevel,
        riskScore: totalRiskScore,
        credibilityScore,
        riskFactors: riskFactors.sort((a, b) => {
          const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
          return severityOrder[a.severity] - severityOrder[b.severity];
        }),
        threatIndicators,
        breakdown: {
          identityRisks: riskFactors.filter(r => r.category === 'identity').length,
          behavioralRisks: riskFactors.filter(r => r.category === 'behavioral').length,
          networkRisks: riskFactors.filter(r => r.category === 'network').length
        }
      },
      recommendations: {
        immediate: riskFactors.filter(r => r.severity === 'critical' || r.severity === 'high')
          .map(r => r.mitigation),
        shortTerm: [
          'Implement continuous monitoring',
          'Cross-verify profile information',
          'Document all findings for future reference'
        ],
        longTerm: [
          'Establish baseline identity markers',
          'Set up automated alerts',
          'Regular reassessment schedule'
        ]
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Risk scoring error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Risk scoring failed'
    }, { status: 500 });
  }
}
