import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserId } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Store the pitch-deck / resume PDF in the database (as bytes) instead of on
 * disk, so it persists on read-only/serverless hosts like Vercel.
 */
export async function POST(request: Request) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    const fileName = file.name || '';
    const isPdf = fileName.toLowerCase().endsWith('.pdf') || (file.type === 'application/pdf');
    if (!isPdf) {
      return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 8MB)' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    await db.appConfig.upsert({
      where: { userId },
      update: { resumeData: buffer, resumeName: file.name || 'pitch_deck.pdf' },
      create: { userId, resumeData: buffer, resumeName: file.name || 'pitch_deck.pdf' },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to upload resume:', error);
    return NextResponse.json({ error: 'Failed to upload resume' }, { status: 500 });
  }
}
