import { NextResponse } from 'next/server';
import { analyzeEmail } from '@/lib/spam-check';
import { getUserId } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Pre-send deliverability / spam-content score for a draft.
 * Body: { subject, body } -> SpamReport.
 */
export async function POST(request: Request) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { subject, body } = await request.json();
    const report = analyzeEmail(subject || '', body || '');
    return NextResponse.json(report);
  } catch {
    return NextResponse.json({ error: 'Failed to analyze email' }, { status: 500 });
  }
}
