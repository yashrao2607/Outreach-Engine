import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const suppressions = await db.suppression.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, suppressions });
  } catch (error) {
    console.error('Failed to fetch suppressions:', error);
    return NextResponse.json({ error: 'Failed to fetch suppressions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email, reason = 'manual' } = await request.json();
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    const normalized = email.trim().toLowerCase();

    const record = await db.suppression.upsert({
      where: { userId_email: { userId, email: normalized } },
      update: { reason },
      create: { userId, email: normalized, reason },
    });

    // Also update any existing matching contact
    await db.hrContact.updateMany({
      where: { userId, email: normalized },
      data: { unsubscribed: true, unsubscribedAt: new Date() },
    });

    return NextResponse.json({ success: true, record });
  } catch (error) {
    console.error('Failed to add suppression:', error);
    return NextResponse.json({ error: 'Failed to add suppression' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalized = email.trim().toLowerCase();

    await db.suppression.deleteMany({
      where: { userId, email: normalized },
    });

    // Re-enable contact in directory
    await db.hrContact.updateMany({
      where: { userId, email: normalized },
      data: { unsubscribed: false, unsubscribedAt: null },
    });

    return NextResponse.json({ success: true, message: `Removed ${normalized} from suppression list` });
  } catch (error) {
    console.error('Failed to remove suppression:', error);
    return NextResponse.json({ error: 'Failed to remove suppression' }, { status: 500 });
  }
}
