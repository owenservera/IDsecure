import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    
    const investigation = await db.investigation.findUnique({
      where: { id },
      include: {
        results: true,
        riskAssessment: true,
        breaches: true,
      }
    });

    if (!investigation) {
      return NextResponse.json({ success: false, error: 'Investigation not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, investigation });
  } catch (error) {
    console.error('Fetch investigation error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch investigation' }, { status: 500 });
  }
}
