import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getUserId } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contacts = await db.hrContact.findMany({
      where: { userId },
      include: {
        followUps: {
          orderBy: { step: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(contacts);
  } catch (error) {
    console.error('Failed to get HR contacts:', error);
    return NextResponse.json(
      { error: 'Failed to get HR contacts' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, email, title, company } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      );
    }

    const contact = await db.hrContact.create({
      data: {
        name,
        email: email.trim().toLowerCase(),
        title: title ?? '',
        company: company ?? '',
        userId,
        abVariant: Math.random() > 0.5 ? 'A' : 'B',
      },
      include: {
        followUps: true,
      },
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    console.error('Failed to create HR contact:', error);
    return NextResponse.json(
      { error: 'Failed to create HR contact' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await db.hrContact.deleteMany({ where: { userId } });
    return NextResponse.json({ success: true, message: 'All contacts deleted successfully' });
  } catch (error) {
    console.error('Failed to delete all HR contacts:', error);
    return NextResponse.json(
      { error: 'Failed to delete all HR contacts' },
      { status: 500 }
    );
  }
}

