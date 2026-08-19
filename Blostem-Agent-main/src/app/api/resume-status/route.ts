import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { existsSync } from 'fs';
import path from 'path';
import { getUserId } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Reports whether a pitch-deck/resume PDF is configured. Primary source is the
 * DB (works on serverless); falls back to a bundled public/resume.pdf for
 * backward compatibility with older self-hosted setups.
 */
export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await db.appConfig.findUnique({
      where: { userId },
      select: { resumeData: true, resumeName: true },
    });
    if (config?.resumeData && config.resumeData.length > 0) {
      return NextResponse.json({ exists: true, filename: config.resumeName || 'pitch_deck.pdf' });
    }

    return NextResponse.json({ exists: false, filename: '' });
  } catch (error) {
    console.error('Failed to check resume status:', error);
    return NextResponse.json({ error: 'Failed to check resume status' }, { status: 500 });
  }
}
