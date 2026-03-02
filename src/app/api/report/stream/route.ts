import { NextRequest, NextResponse } from 'next/server';
import { db, dbRead } from '@/lib/db-pool';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const investigationId = searchParams.get('id') || (await request.json()).investigationId;

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  (async () => {
    try {
      const investigation = await db.investigation.findUnique({
        where: { id: investigationId },
        include: {
          results: {
            orderBy: { confidence: 'desc' },
          },
          riskAssessment: true,
          breaches: true,
        },
      });

      if (!investigation) {
        await writer.write(encoder.encode(`event: error\ndata: ${JSON.stringify({
          message: 'Investigation not found'
        })}\n\n`));
        await writer.close();
        return;
      }

      await writer.write(encoder.encode(`event: status\ndata: ${JSON.stringify({
        stage: 'initializing',
        progress: 0
      })}\n\n`));

      const sections = [
        { id: 'cover', title: 'Evidentiary Cover Sheet', type: 'section' },
        { id: 'summary', title: 'Executive Summary', type: 'section' },
        { id: 'profiles', title: 'Verified Identity Assets', type: 'profiles' },
        { id: 'risk', title: 'Risk & Threat Assessment', type: 'section' },
        { id: 'forensics', title: 'Digital Forensics Analysis', type: 'section' },
        { id: 'conclusion', title: 'Sworn Conclusion', type: 'section' },
      ];

      for (const section of sections) {
        await writer.write(encoder.encode(`event: status\ndata: ${JSON.stringify({
          stage: section.id,
          progress: (sections.indexOf(section) / sections.length) * 100)
        })}\n\n`));

        switch (section.id) {
          case 'cover':
            await writer.write(encoder.encode(`event: section\ndata: ${JSON.stringify({
              id: section.id,
              title: section.title,
              content: generateCoverSheet(investigation)
            })}\n\n`));
            break;

          case 'summary':
            await writer.write(encoder.encode(`event: status\ndata: ${JSON.stringify({
              stage: 'executive_summary',
              progress: 40
            })}\n\n`));

            const summaryContent = await generateExecutiveSummary(investigation);
            await writer.write(encoder.encode(`event: section\ndata: ${JSON.stringify({
              id: section.id,
              title: section.title,
              content: summaryContent
            })}\n\n`));
            break;

          case 'profiles':
            await writer.write(encoder.encode(`event: status\ndata: ${JSON.stringify({
              stage: 'profiles',
              progress: 60
            })}\n\n`));

            const profiles = investigation.results || [];
            for (const profile of profiles.slice(0, 50)) {
              await writer.write(encoder.encode(`event: profile\ndata: ${JSON.stringify(profile)}\n\n`));
            }
            break;

          case 'risk':
            await writer.write(encoder.encode(`event: status\ndata: ${JSON.stringify({
              stage: 'risk_assessment',
              progress: 80
            })}\n\n`));

            const riskContent = await generateRiskSection(investigation);
            await writer.write(encoder.encode(`event: section\ndata: ${JSON.stringify({
              id: section.id,
              title: section.title,
              content: riskContent
            })}\n\n`));
            break;

          case 'forensics':
            await writer.write(encoder.encode(`event: status\ndata: ${JSON.stringify({
              stage: 'forensics',
              progress: 90
            })}\n\n`));

            const forensicsContent = await generateForensicsSection(investigation);
            await writer.write(encoder.encode(`event: section\ndata: ${JSON.stringify({
              id: section.id,
              title: section.title,
              content: forensicsContent
            })}\n\n`));
            break;

          case 'conclusion':
            await writer.write(encoder.encode(`event: status\ndata: ${JSON.stringify({
              stage: 'conclusion',
              progress: 100
            })}\n\n`));

            const conclusionContent = await generateConclusion(investigation);
            await writer.write(encoder.encode(`event: section\ndata: ${JSON.stringify({
              id: section.id,
              title: section.title,
              content: conclusionContent
            })}\n\n`));
            break;
        }
      }

      await writer.write(encoder.encode(`event: complete\ndata: ${JSON.stringify({
        progress: 100,
        timestamp: new Date().toISOString()
      })}\n\n`));

    } catch (error) {
      console.error('Report generation error:', error);
      await writer.write(encoder.encode(`event: error\ndata: ${JSON.stringify({
        message: error instanceof Error ? error.message : 'Report generation failed'
      })}\n\n`));
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

function generateCoverSheet(investigation: any): string {
  return `
# Evidentiary Cover Sheet

**Case ID:** ${investigation.id}
**Date Generated:** ${new Date().toISOString()}
**Subject:** ${investigation.name || investigation.email || investigation.username || 'Unknown'}

---

## Investigation Parameters

| Parameter | Value |
|-----------|-------|
| Name | ${investigation.name || 'N/A'} |
| Email | ${investigation.email || 'N/A'} |
| Phone | ${investigation.phone || 'N/A'} |
| Username | ${investigation.username || 'N/A'} |

---

## Statistics Summary

| Metric | Value |
|---------|-------|
| Total Profiles | ${investigation.results?.length || 0} |
| High Confidence Profiles | ${investigation.results?.filter((r: any) => r.confidence >= 80).length || 0} |
| Risk Level | ${investigation.riskAssessment?.riskLevel?.toUpperCase() || 'N/A'} |
| Risk Score | ${investigation.riskAssessment?.overallScore || 0}/100 |
  `.trim();
}

async function generateExecutiveSummary(investigation: any): Promise<string> {
  const zai = await ZAI.create();

  const prompt = `Generate an executive summary for this investigation:

Investigation: ${investigation.name || 'N/A'}
Email: ${investigation.email || 'N/A'}
Username: ${investigation.username || 'N/A'}
Total Profiles: ${investigation.results?.length || 0}
Risk Level: ${investigation.riskAssessment?.riskLevel || 'N/A'}
Risk Score: ${investigation.riskAssessment?.overallScore || 0}/100

Profile Summary:
${(investigation.results || []).slice(0, 5).map((r: any, i) => `${i+1}. ${r.platform}: ${r.title} (${r.confidence}% confidence)`).join('\n')}

Generate a professional executive summary in Markdown format with these sections:
1. Investigation Overview
2. Key Findings
3. Risk Assessment Summary
4. Recommendations

Keep it concise and professional.`;

  // Use text model with thinking mode for complex report generation
  const textModel = process.env.ZAI_MODEL_TEXT || 'glm-4.7-flash';

  const completion = await zai.chat.completions.create({
    model: textModel,
    messages: [
      { role: 'system', content: 'You are an expert investigative analyst writing executive summaries for legal and corporate cases. Think step-by-step to ensure comprehensive analysis.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    thinking: { type: 'enabled' },
    max_tokens: 2048,
  });

  return completion.choices[0]?.message?.content || 'Failed to generate executive summary';
}

async function generateRiskSection(investigation: any): Promise<string> {
  const riskAssessment = investigation.riskAssessment;

  if (!riskAssessment) {
    return 'No risk assessment available for this investigation.';
  }

  const factors = JSON.parse(riskAssessment.factors || '{}');
  const riskFactors = factors.riskFactors || [];

  let content = `## Risk & Threat Assessment

**Overall Risk Level:** ${riskAssessment.riskLevel?.toUpperCase() || 'N/A'}
**Overall Risk Score:** ${riskAssessment.overallScore}/100

### Risk Factors

| Factor | Category | Severity | Score | Mitigation |
|---------|----------|----------|-------|------------|
${riskFactors.map((f: any) => {
  const score = f.score || 0;
  const category = f.category || 'unknown';
  const severity = f.severity || 'unknown';
  return `| ${f.factor || 'N/A'} | ${category} | ${severity} | ${score} | ${f.mitigation || 'N/A'} |`;
}).join('\n')}

### Threat Indicators

${riskFactors.map((f: any, i: number) => {
  if (f.category === 'identity' && severity.includes('high')) {
    return `${i+1}. ${f.factor || 'N/A'} - ${f.description || 'N/A'}`;
  }
  return null;
}).filter(Boolean).join('\n') || 'No significant threat indicators identified.'}
`;

  return content.trim();
}

async function generateForensicsSection(investigation: any): Promise<string> {
  const zai = await ZAI.create();

  const prompt = `Generate a digital forensics analysis for this investigation:

Subject: ${investigation.name || investigation.email || investigation.username}
Total Profiles: ${investigation.results?.length || 0}

Available Data:
${(investigation.results || []).slice(0, 10).map((r: any, i) => `${i+1}. ${r.platform}: ${r.title}`).join('\n')}

Generate a professional forensics analysis in Markdown format with these sections:
1. Image Analysis (if available)
2. Profile Authenticity Assessment
3. Cross-Platform Consistency
4. Digital Footprint Analysis
5. Recommendations

Keep it technical and actionable.`;

  // Use advanced vision model for forensics analysis
  const visionModel = process.env.ZAI_MODEL_VISION_ADVANCED || 'glm-4.6v';

  const completion = await zai.chat.completions.create({
    model: visionModel,
    messages: [
      { role: 'system', content: 'You are a digital forensics expert specializing in OSINT investigations. Think step-by-step for thorough analysis.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    thinking: { type: 'enabled' },
    max_tokens: 2048,
  });

  return completion.choices[0]?.message?.content || 'No forensics analysis available.';
}

async function generateConclusion(investigation: any): Promise<string> {
  const zai = await ZAI.create();

  const prompt = `Generate a professional conclusion for this investigation:

Subject: ${investigation.name || investigation.email || investigation.username}
Total Profiles: ${investigation.results?.length || 0}
Risk Level: ${investigation.riskAssessment?.riskLevel || 'N/A'}

Investigation Summary:
${(investigation.results || []).slice(0, 5).map((r: any, i) => `${i+1}. ${r.platform}: ${r.title} (${r.confidence}% confidence)`).join('\n')}

Generate a sworn conclusion in Markdown format that:
1. Summarizes key findings
2. States professional assessment
3. Provides actionable recommendations
4. Maintains objective tone
5. Is suitable for inclusion in a legal or corporate report

Use formal, professional language.`;

  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'system', content: 'You are a senior intelligence analyst writing conclusions for legal investigations.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 800,
  });

  return completion.choices[0]?.message?.content || 'Unable to generate conclusion.';
}
