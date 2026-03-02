#!/usr/bin/env python3
"""
Enhanced PDF Report Generator with Charts
Generates professional investigation reports with charts and branding
"""

import json
import base64
import os
from io import BytesIO
from datetime import datetime
from typing import Dict, List, Any

try:
  from reportlab.lib import colors
  from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.utils import ImageReader
    from reportlab.graphics.shapes import Drawing, Rect
    from reportlab.graphics.charts.lineplots import LinePlot
    from reportlab.graphics.charts.barcharts import VerticalBarChart
    from reportlab.graphics.charts.piecharts import PieChart, Wedge
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_BOTTOM, TA_TOP
except ImportError as e:
    print(f"Missing required library: {e}")
    print("Install: pip install reportlab")
    exit(1)

class ReportGenerator:
    def __init__(self, brand_colors=None):
        self.brand_colors = brand_colors or {
            'primary': '#6366f1',
            'secondary': '#8b5cf6',
            'accent': '#8b5cf6',
            'text': '#1e293b',
            'light': '#f8fafc',
            'dark': '#1e293b',
            'success': '#10b981',
            'warning': '#f59e0b',
            'danger': '#ef4444',
        }

    def generate_pdf(self, data: Dict[str, Any], output_path: str) -> str:
        """Generate enhanced PDF report with charts"""

        doc = SimpleDocTemplate(
            output_path,
            pagesize=letter,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=18,
        )

        styles = getSampleStyleSheet()
        custom_styles = self._get_custom_styles(styles)

        story = []

        story.append(Spacer(1, 0.3*inch))

        title = self._create_title_page(doc, custom_styles, data)
        story.append(title)

        content = self._create_content_section(doc, custom_styles, data)
        story.extend(content)

        summary = self._create_summary_section(doc, custom_styles, data)
        story.append(summary)

        story.append(Spacer(1, 0.2*inch))

        story.append(PageBreak())

        # Build PDF
        doc.build(story)

        return output_path

    def _get_custom_styles(self, styles: ParagraphStyle):
            styles.add(ParagraphStyle(
                name='CustomHeader',
                parent=styles['Heading1'],
                fontSize=24,
                textColor=self.brand_colors['primary'],
                spaceAfter=30,
            )
            )

            styles.add(ParagraphStyle(
                name='CustomSubHeader',
                parent=styles['Heading2'],
                fontSize=14,
                textColor=self.brand_colors['text'],
                spaceAfter=12,
            )
            )

            styles.add(ParagraphStyle(
                name='CustomInfo',
                parent=styles['BodyText'],
                fontSize=10,
                textColor=self.brand_colors['text'],
            ))

            return styles

    def _create_title_page(self, doc, styles: Dict[str, Any], data: Dict[str, Any]) -> List:
        """Create cover page with branding"""

        story = []

        # Branding header
        header = Paragraph(
            "IDSECURE INTELLIGENCE REPORT",
            custom_styles['CustomHeader'],
            spaceAfter=30
        )
        story.append(header)

        # Case metadata table
        metadata_data = [
            ['Case ID', data.get('investigationId', 'AUTO-GEN')],
            ['Date Generated', data.get('generatedAt', datetime.now().isoformat())[:10]],
            ['Total Profiles', str(len(data.get('results', [])))],
            ['Risk Level', data.get('riskAssessment', {}).get('overallRiskLevel', 'N/A').upper()],
            ['Risk Score', str(data.get('riskAssessment', {}).get('overallScore', 0))],
            ['Officer', data.get('officer', 'Lead Analyst')],
        ]

        metadata_table = Table(
            metadata_data,
            colWidths=[1.5*inch, 4*inch],
            style=TableStyle([
                ('BACKGROUND', self.brand_colors['light']),
                ('TEXTCOLOR', self.brand_colors['text']),
                ('FONTNAME', 'Helvetica'),
                ('FONTSIZE', 10),
                ('BOTTOMPADDING', (12, 12)),
                ('GRID', (1, 1, self.brand_colors['dark']),
            ])
        )
        story.append(metadata_table)

        story.append(Spacer(1, 0.5*inch))

        return story

    def _create_content_section(self, doc, styles: Dict[str, Any], data: Dict[str, Any]) -> List:
        """Create main content with charts"""

        story = []

        # Executive Summary
        summary = data.get('searchQuery', {})
        results = data.get('results', [])
        risk_assessment = data.get('riskAssessment', {})

        story.append(Paragraph("EXECUTIVE SUMMARY", styles['CustomSubHeader']))
        story.append(Spacer(1, 0.2*inch))

        summary_text = f"""
        This report documents findings from an open-source intelligence (OSINT) investigation
        targeting {summary.get('name', 'the subject') or 'the subject'}.

        Investigation identified {len(results)} unique digital profiles across multiple platforms
        with an average confidence score of {
            (sum(r.get('confidence', 0) for r in results) / len(results) if results else 0
        :.1f}%.

        Overall risk assessment: {risk_assessment.get('overallRiskLevel', 'low').upper()}
        (Score: {risk_assessment.get('overallScore', 0)}/100).
        """

        story.append(Paragraph(summary_text, styles['CustomInfo']))
        story.append(Spacer(1, 0.3*inch))

        # Platform Distribution Chart
        if results:
            story.append(Paragraph("PLATFORM DISTRIBUTION", styles['CustomSubHeader']))
            story.append(Spacer(1, 0.2*inch))

            platform_dist_chart = self._create_platform_chart(results)
            story.append(platform_dist_chart)
            story.append(Spacer(1, 0.3*inch))

        # Verified Profiles Table
        if results:
            story.append(Paragraph("VERIFIED IDENTITY ASSETS", styles['CustomSubHeader']))
            story.append(Spacer(1, 0.2*inch))

            profiles_table = self._create_profiles_table(results)
            story.extend(profiles_table)
            story.append(Spacer(1, 0.3*inch))

        # Risk Assessment
        if risk_assessment:
            story.append(Paragraph("RISK & THREAT ASSESSMENT", styles['CustomSubHeader']))
            story.append(Spacer(1, 0.2*inch))

            risk_section = self._create_risk_section(risk_assessment)
            story.extend(risk_section)
            story.append(Spacer(1, 0.3*inch))

        story.append(PageBreak())

        return story

    def _create_platform_chart(self, results: List[Dict]) -> Drawing:
        """Create platform distribution bar chart"""

        if not results:
            return Drawing(200, 100)

        platform_counts = {}
        for r in results:
            platform = r.get('platform', 'Web')
            platform_counts[platform] = platform_counts.get(platform, 0) + 1

        sorted_platforms = sorted(platform_counts.items(), key=lambda x: x[1], reverse=True)
        top_5 = sorted_platforms[:5]

        platforms = [p[0] for p in top_5]
        counts = [p[1] for p in top_5]

        drawing = Drawing(200, 150)
        title_height = 1.5*inch

        title = Paragraph(
            "Platform Distribution (Top 5)",
            styles['CustomInfo']
        )
        drawing.addString(title)
        drawing.y += 60

        # Create bar chart
        bc = VerticalBarChart()
        bc.x = 0.5*inch
        bc.y = 1.5*inch
        bc.height = 2*inch
        bc.data = [counts]
        bc.categoryAxis.categoryNames = platforms
        bc.categoryAxis.style['categoryAxisLabels'] = dict(
            dx=styles['CustomInfo'],
            dy=styles['CustomInfo'],
            fontSize=9,
            fontName='Helvetica',
        )
        bc.valueAxis.valueMin = 0
        bc.valueAxis.valueMax = max(counts) + 5
        bc.bars[0].fillColor = self.brand_colors['primary']
        bc.bars[0].strokeColor = self.brand_colors['primary']
        bc.bars[0].strokeWidth = 1

        drawing.add(bc)
        return drawing

    def _create_profiles_table(self, results: List[Dict]) -> List:
        """Create verified profiles table"""

        table_data = [
            ['Platform', 'Title', 'URL', 'Confidence', 'Location', 'Company', 'Profession'],
        ]

        sorted_results = sorted(results, key=lambda x: x.get('confidence', 0), reverse=True)

        for r in sorted_results[:20]:
            table_data.append([
                r.get('platform', 'N/A'),
                r.get('title', 'Unknown')[:30],
                r.get('url', 'N/A')[:40],
                f"{r.get('confidence', 0)}%",
                (r.get('location', 'N/A')[:20] or 'N/A'),
                (r.get('company', 'N/A')[:20] or 'N/A'),
                (r.get('profession', 'N/A')[:20] or 'N/A'),
            ])

        table = Table(
            table_data,
            colWidths=[1*inch, 2*inch, 2*inch, 0.8*inch, 1.2*inch, 1.2*inch, 2*inch],
            style=TableStyle([
                ('BACKGROUND', self.brand_colors['light']),
                ('TEXTCOLOR', self.brand_colors['text']),
                ('FONTNAME', 'Helvetica'),
                ('FONTSIZE', 9),
                ('BOTTOMPADDING', (12, 12)),
                ('GRID', (1, 1, self.brand_colors['dark'])),
            ])
        )

        return [table]

    def _create_risk_section(self, risk_assessment: Dict) -> List:
        """Create risk assessment section"""

        risk_factors = risk_assessment.get('riskFactors', [])
        threat_indicators = risk_assessment.get('threatIndicators', [])

        story = []

        if risk_factors:
            risk_data = [
                ['Factor', 'Category', 'Severity', 'Score', 'Mitigation'],
            ]

            for factor in risk_factors[:10]:
                severity = factor.get('severity', 'unknown')
                score = factor.get('score', 0)
                severity_color = {
                    'critical': '#ef4444',
                    'high': '#f97316',
                    'medium': '#f59e0b',
                    'low': '#10b981',
                }.get(severity, '#f97316')

                risk_data.append([
                    factor.get('factor', 'N/A'),
                    factor.get('category', 'N/A'),
                    severity.upper(),
                    score,
                    (factor.get('mitigation', 'N/A')[:50] or 'N/A'),
                ])

            risk_table = Table(
                risk_data,
                colWidths=[2*inch, 1.5*inch, 0.8*inch, 1.2*inch, 1.2*inch],
                style=TableStyle([
                    ('BACKGROUND', severity_color),
                    ('TEXTCOLOR', self.brand_colors['text']),
                    ('FONTNAME', 'Helvetica'),
                    ('FONTSIZE', 9),
                    ('BOTTOMPADDING', (12, 12)),
                    ('GRID', (1, 1, self.brand_colors['dark'])),
                ])
            )
            story.extend(risk_table)

        if threat_indicators:
            story.append(Spacer(1, 0.2*inch))
            story.append(Paragraph("THREAT INDICATORS", styles['CustomSubHeader']))
            story.append(Spacer(1, 0.1*inch))

            for (indicator in threat_indicators[:5]):
                indicator_text = f"""
                • {indicator.get('type', 'N/A')}
                  - Confidence: {indicator.get('confidence', 0)}%
                  - {indicator.get('source', 'N/A')}
                  - {indicator.get('details', 'N/A')[:100]}
                  - Recommended Action: {indicator.get('recommendedAction', 'N/A')}
                """
                story.append(Paragraph(indicator_text, styles['CustomInfo']))

            story.append(Spacer(1, 0.1*inch))

        return story

    def _create_summary_section(self, doc, styles: Dict, data: Dict) -> List:
        """Create summary section with key findings"""

        story = []

        results = data.get('results', [])
        risk_assessment = data.get('riskAssessment', {})
        breaches = data.get('breachResults', {}).get('breachResults', [])

        summary = f"""
        This report documents findings from a comprehensive OSINT investigation.

        Investigation Target:
        - Name: {data.get('searchQuery', {}).get('name', 'N/A')}
        - Email: {data.get('searchQuery', {}).get('email', 'N/A')}
        - Username: {data.get('searchQuery', {}).get('username', 'N/A')}

        Investigation Results:
        - Total Profiles Discovered: {len(results)}
        - High Confidence Profiles (≥80% confidence): {len([r for r in results if r.get('confidence', 0) >= 80])}
        - Platforms Covered: {len(set(r.get('platform', 'Web') for r in results))}
        - Average Confidence Score: {sum(r.get('confidence', 0) for r in results) / len(results) if results else 0:.1f}

        Risk Assessment:
        - Overall Risk Level: {risk_assessment.get('overallRiskLevel', 'N/A').upper()}
        - Risk Score: {risk_assessment.get('overallScore', 0)}/100

        Threat Indicators:
        - {len(threats.get('breachResults', []))} breach incidents detected
        - {len([f for f in threat_indicators if f.get('type') in ['credential_exposure', 'impersonation'])])} critical threats identified
        """

        story.append(Paragraph(summary, styles['CustomInfo']))
        story.append(Spacer(1, 0.2*inch))

        return story

def generate_enhanced_pdf(input_json: str, output_path: str) -> str:
    """
    Main entry point for PDF generation
    """
    print(f"Reading input from: {input_json}")

    with open(input_json, 'r') as f:
        data = json.load(f)

    generator = ReportGenerator()

    try:
        output = generator.generate_pdf(data, output_path)
        print(f"✅ PDF generated successfully: {output}")
        return output
    except Exception as e:
        print(f"❌ PDF generation failed: {e}")
        raise

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 2:
        input_json = sys.argv[1]
        output_path = sys.argv[2]
    else:
        print("Usage: python generate_enhanced_pdf.py <input_json> <output_pdf>")
        sys.exit(1)
