#!/usr/bin/env python3
"""
Enhanced Social Intelligence Report Generator - Cross-Platform Version
Generates comprehensive PDF reports with analytics, cross-reference analysis, and detailed findings.
"""

import json
import sys
import os
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image, HRFlowable, KeepTogether
)

# Color palette
COLORS = {
    'primary': colors.HexColor('#020617'),
    'secondary': colors.HexColor('#1E293B'),
    'accent': colors.HexColor('#64748B'),
    'highlight': colors.HexColor('#8B5CF6'),
    'background': colors.HexColor('#F8FAFC'),
    'header_bg': colors.HexColor('#1F4E79'),
    'success': colors.HexColor('#10B981'),
    'warning': colors.HexColor('#F59E0B'),
    'danger': colors.HexColor('#EF4444'),
    'violet': colors.HexColor('#7C3AED'),
}


def create_styles():
    """Create custom paragraph styles using standard fonts."""
    styles = getSampleStyleSheet()
    
    styles.add(ParagraphStyle(
        name='ReportTitle',
        fontName='Helvetica-Bold',
        fontSize=26,
        leading=32,
        alignment=TA_CENTER,
        textColor=COLORS['primary'],
        spaceAfter=8,
    ))
    
    styles.add(ParagraphStyle(
        name='ReportSubtitle',
        fontName='Helvetica',
        fontSize=13,
        leading=18,
        alignment=TA_CENTER,
        textColor=COLORS['accent'],
        spaceAfter=20,
    ))
    
    styles.add(ParagraphStyle(
        name='SectionHeader',
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=COLORS['primary'],
        spaceBefore=16,
        spaceAfter=10,
    ))
    
    styles.add(ParagraphStyle(
        name='ReportBody',
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        alignment=TA_JUSTIFY,
        textColor=COLORS['secondary'],
        spaceAfter=6,
    ))
    
    styles.add(ParagraphStyle(
        name='HighlightText',
        fontName='Helvetica-Oblique',
        fontSize=10,
        leading=14,
        alignment=TA_LEFT,
        textColor=COLORS['secondary'],
        leftIndent=15,
        rightIndent=15,
        spaceBefore=6,
        spaceAfter=6,
        backColor=COLORS['background'],
    ))
    
    styles.add(ParagraphStyle(
        name='TableHeader',
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11,
        alignment=TA_CENTER,
        textColor=colors.white,
    ))
    
    styles.add(ParagraphStyle(
        name='TableCell',
        fontName='Helvetica',
        fontSize=8,
        leading=10,
        alignment=TA_LEFT,
        textColor=COLORS['secondary'],
    ))
    
    return styles


def create_cover_page(story, styles, data):
    """Create cover page."""
    story.append(Spacer(1, 1.5*inch))
    
    story.append(Paragraph(
        "<b>Evidentiary Intelligence Brief</b>",
        styles['ReportTitle']
    ))
    
    query_info = data.get('searchQuery', {})
    query_parts = []
    if query_info.get('name'): query_parts.append(query_info['name'])
    if query_info.get('username'): query_parts.append(query_info['username'])
    
    query_name = ' | '.join(query_parts) if query_parts else 'Anonymous Investigation'
    
    story.append(Paragraph(
        f"<b>Subject:</b> {query_name}",
        styles['ReportSubtitle']
    ))
    
    story.append(Spacer(1, 0.3*inch))
    
    # Metadata
    timestamp = datetime.now().strftime("%B %d, %Y at %H:%M")
    story.append(Paragraph(f"<b>Generated:</b> {timestamp}", styles['ReportBody']))
    story.append(Paragraph(f"<b>Case ID:</b> {data.get('investigationId', 'N/A')}", styles['ReportBody']))
    
    story.append(Spacer(1, 0.5*inch))
    
    # Classification
    story.append(Paragraph(
        "<b>CLASSIFICATION:</b> FOR OFFICIAL USE ONLY (FOUO)",
        ParagraphStyle(name='Class', fontName='Helvetica-Bold', fontSize=10, 
                      alignment=TA_CENTER, textColor=COLORS['danger'])
    ))
    
    story.append(PageBreak())


def create_executive_summary(story, styles, data):
    """Create executive summary."""
    story.append(Paragraph("<b>1. Executive Summary</b>", styles['SectionHeader']))
    story.append(HRFlowable(width="100%", thickness=1, color=COLORS['highlight']))
    story.append(Spacer(1, 8))
    
    results = data.get('results', [])
    risk = data.get('riskAssessment', {})
    
    summary = f"""
    This document serves as a formal summary of findings for the intelligence investigation targeting 
    '{data.get('searchQuery', {}).get('name', 'the subject')}'. 
    An automated Recursive Agentic Search was deployed, discovering {len(results)} distinct profile nodes.
    """
    
    story.append(Paragraph(summary.strip(), styles['ReportBody']))
    
    risk_level = risk.get('overallRiskLevel', 'low').upper()
    story.append(Paragraph(f"<b>Computed Risk Level:</b> {risk_level}", styles['HighlightText']))


def create_profiles_table(story, styles, data):
    """Create profiles table."""
    results = data.get('results', [])
    story.append(Spacer(1, 12))
    story.append(Paragraph("<b>2. Discovered Identity Assets</b>", styles['SectionHeader']))
    story.append(HRFlowable(width="100%", thickness=1, color=COLORS['highlight']))
    
    if not results:
        story.append(Paragraph("No assets discovered.", styles['ReportBody']))
        return
    
    header = [
        Paragraph('<b>#</b>', styles['TableHeader']),
        Paragraph('<b>Platform</b>', styles['TableHeader']),
        Paragraph('<b>Title</b>', styles['TableHeader']),
        Paragraph('<b>Confidence</b>', styles['TableHeader']),
    ]
    
    table_data = [header]
    for i, r in enumerate(results[:25]):
        table_data.append([
            str(i+1),
            r.get('platform', 'Web'),
            r.get('title', 'N/A')[:40],
            f"{r.get('confidence', 0):.0f}%"
        ])
    
    table = Table(table_data, colWidths=[0.5*inch, 1.2*inch, 3.5*inch, 1.0*inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COLORS['header_bg']),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
    ]))
    story.append(table)


def generate_report(input_data, output_path):
    """Main generator function."""
    if isinstance(input_data, str):
        data = json.loads(input_data)
    else:
        data = input_data
        
    doc = SimpleDocTemplate(output_path, pagesize=letter)
    styles = create_styles()
    story = []
    
    create_cover_page(story, styles, data)
    create_executive_summary(story, styles, data)
    create_profiles_table(story, styles, data)
    
    doc.build(story)
    return output_path


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(1)
    
    with open(sys.argv[1], 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    generate_report(data, sys.argv[2])
    print(f"Report generated: {sys.argv[2]}")
