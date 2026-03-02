import { NextRequest, NextResponse } from 'next/server';

interface Profile {
  platform: string;
  url: string;
  title: string;
  snippet: string;
  confidence: number;
  location?: string;
  company?: string;
  profession?: string;
  stage?: number;
  verified?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      profiles, 
      searchQuery, 
      searchStats, 
      statisticalAnalysis,
      entityResolution,
      riskAssessment,
      breachResults,
      format = 'json'
    } = body;

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ success: false, error: 'No data to export' });
    }

    const timestamp = new Date().toISOString();
    const filename = `social_intelligence_export_${Date.now()}`;

    if (format === 'csv') {
      // Generate CSV
      const headers = [
        'Platform',
        'Title',
        'URL',
        'Confidence',
        'Location',
        'Company',
        'Profession',
        'Stage',
        'Verified',
        'Snippet'
      ];

      const csvRows = [
        headers.join(','),
        ...profiles.map((p: Profile) => [
          `"${p.platform}"`,
          `"${(p.title || '').replace(/"/g, '""')}"`,
          `"${p.url}"`,
          p.confidence,
          `"${(p.location || '').replace(/"/g, '""')}"`,
          `"${(p.company || '').replace(/"/g, '""')}"`,
          `"${(p.profession || '').replace(/"/g, '""')}"`,
          p.stage || '',
          p.verified || false,
          `"${(p.snippet || '').replace(/"/g, '""').substring(0, 200)}"`
        ].join(','))
      ];

      // Add summary section
      csvRows.push('');
      csvRows.push('SUMMARY');
      csvRows.push(`Total Profiles,${profiles.length}`);
      csvRows.push(`High Confidence,${profiles.filter((p: Profile) => p.confidence >= 80).length}`);
      csvRows.push(`Export Date,${timestamp}`);

      const csvContent = csvRows.join('\n');

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}.csv"`
        }
      });
    }

    if (format === 'json') {
      // Generate comprehensive JSON export
      const exportData = {
        metadata: {
          exportDate: timestamp,
          version: '2.0',
          generator: 'Social Intelligence Engine',
          totalRecords: profiles.length
        },
        searchQuery: {
          ...searchQuery,
          timestamp
        },
        results: {
          profiles: profiles.map((p: Profile) => ({
            ...p,
            exportedAt: timestamp
          })),
          statistics: searchStats || {},
          analysis: statisticalAnalysis || {}
        },
        advancedAnalysis: {
          entityResolution: entityResolution || null,
          riskAssessment: riskAssessment || null,
          breachMonitoring: breachResults || null
        },
        summary: {
          totalProfiles: profiles.length,
          platforms: [...new Set(profiles.map((p: Profile) => p.platform))],
          averageConfidence: (profiles.reduce((sum: number, p: Profile) => sum + p.confidence, 0) / profiles.length).toFixed(1),
          highConfidenceCount: profiles.filter((p: Profile) => p.confidence >= 80).length,
          verifiedCount: profiles.filter((p: Profile) => p.verified).length
        }
      };

      return new NextResponse(JSON.stringify(exportData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}.json"`
        }
      });
    }

    if (format === 'markdown') {
      // Generate Markdown report
      const mdLines = [
        `# Social Intelligence Report`,
        ``,
        `**Generated:** ${timestamp}`,
        `**Total Profiles:** ${profiles.length}`,
        ``,
        `## Search Parameters`,
        ``,
        `| Parameter | Value |`,
        `|-----------|-------|`,
        `| Name | ${searchQuery?.name || 'N/A'} |`,
        `| Email | ${searchQuery?.email || 'N/A'} |`,
        `| Phone | ${searchQuery?.phone || 'N/A'} |`,
        `| Username | ${searchQuery?.username || 'N/A'} |`,
        ``,
        `## Discovered Profiles`,
        ``,
        ...profiles.map((p: Profile) => [
          `### ${p.title || 'Unknown'}`,
          ``,
          `- **Platform:** ${p.platform}`,
          `- **Confidence:** ${p.confidence}%`,
          `- **URL:** [${p.url}](${p.url})`,
          p.location ? `- **Location:** ${p.location}` : '',
          p.company ? `- **Company:** ${p.company}` : '',
          `- **Snippet:** ${p.snippet?.substring(0, 200) || 'N/A'}`,
          ``
        ].filter(Boolean).join('\n')),
        ``,
        `## Statistics`,
        ``,
        `- High Confidence Profiles: ${profiles.filter((p: Profile) => p.confidence >= 80).length}`,
        `- Platforms Covered: ${[...new Set(profiles.map((p: Profile) => p.platform))].length}`,
        `- Average Confidence: ${(profiles.reduce((sum: number, p: Profile) => sum + p.confidence, 0) / profiles.length).toFixed(1)}%`,
        ``,
        `---`,
        `*Report generated by Social Intelligence Engine*`
      ];

      return new NextResponse(mdLines.join('\n'), {
        headers: {
          'Content-Type': 'text/markdown',
          'Content-Disposition': `attachment; filename="${filename}.md"`
        }
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid format specified' });

  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Export failed'
    }, { status: 500 });
  }
}
