import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const investigations = await db.investigation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        createdAt: true,
        _count: {
          select: { results: true }
        }
      }
    });

    return NextResponse.json({ success: true, investigations });
  } catch (error) {
    console.error('Fetch investigations error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch investigations' }, { status: 500 });
  }
}
