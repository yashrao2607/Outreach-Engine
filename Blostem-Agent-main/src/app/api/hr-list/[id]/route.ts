import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getUserId } from '@/lib/session';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const existing = await db.hrContact.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json(
        { error: 'HR contact not found' },
        { status: 404 }
      );
    }

    await db.hrContact.delete({ where: { id, userId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete HR contact:', error);
    return NextResponse.json(
      { error: 'Failed to delete HR contact' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, email, title, company } = body;

    const existing = await db.hrContact.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json(
        { error: 'HR contact not found' },
        { status: 404 }
      );
    }

    const updated = await db.hrContact.update({
      where: { id },
      data: {
        name: name !== undefined ? name : undefined,
        email: email !== undefined ? email : undefined,
        title: title !== undefined ? title : undefined,
        company: company !== undefined ? company : undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update HR contact:', error);
    return NextResponse.json(
      { error: 'Failed to update HR contact' },
      { status: 500 }
    );
  }
}
