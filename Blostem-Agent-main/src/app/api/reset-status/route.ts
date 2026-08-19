import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getUserId } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { hrContactId, ids, all, resetTelemetryOnly } = await request.json();

    if (all) {
      if (resetTelemetryOnly) {
        await db.hrContact.updateMany({
          where: { userId },
          data: {
            opened: false,
            openedAt: null,
            openCount: 0,
            clicked: false,
            clickedAt: null,
            clickCount: 0,
            ctaClicked: false,
            ctaClickedAt: null,
            docClicked: false,
            docClickedAt: null,
          },
        });
      } else {
        await db.hrContact.updateMany({
          where: { userId },
          data: {
            status: 'pending',
            subject: null,
            body: null,
            sentAt: null,
            error: null,
            messageId: null,
            opened: false,
            openedAt: null,
            openCount: 0,
            clicked: false,
            clickedAt: null,
            clickCount: 0,
            ctaClicked: false,
            ctaClickedAt: null,
            docClicked: false,
            docClickedAt: null,
            replyBody: null,
            replySubject: null,
            repliedAt: null,
          },
        });
      }
      return NextResponse.json({ success: true });
    }

    if (ids && Array.isArray(ids)) {
      await db.hrContact.updateMany({
        where: { id: { in: ids }, userId },
        data: resetTelemetryOnly
          ? {
              opened: false,
              openedAt: null,
              openCount: 0,
              clicked: false,
              clickedAt: null,
              clickCount: 0,
              ctaClicked: false,
              ctaClickedAt: null,
              docClicked: false,
              docClickedAt: null,
            }
          : {
              status: 'pending',
              subject: null,
              body: null,
              sentAt: null,
              error: null,
              messageId: null,
              opened: false,
              openedAt: null,
              openCount: 0,
              clicked: false,
              clickedAt: null,
              clickCount: 0,
              ctaClicked: false,
              ctaClickedAt: null,
              docClicked: false,
              docClickedAt: null,
              replyBody: null,
              replySubject: null,
              repliedAt: null,
            },
      });
      return NextResponse.json({ success: true });
    }

    if (!hrContactId) {
      return NextResponse.json(
        { error: 'hrContactId or ids or all is required' },
        { status: 400 }
      );
    }

    const hrContact = await db.hrContact.findFirst({
      where: { id: hrContactId, userId }
    });
    if (!hrContact) {
      return NextResponse.json(
        { error: 'HR contact not found' },
        { status: 404 }
      );
    }

    await db.hrContact.update({
      where: { id: hrContactId, userId },
      data: resetTelemetryOnly
        ? {
            opened: false,
            openedAt: null,
            openCount: 0,
            clicked: false,
            clickedAt: null,
            clickCount: 0,
            ctaClicked: false,
            ctaClickedAt: null,
            docClicked: false,
            docClickedAt: null,
          }
        : {
            status: 'pending',
            subject: null,
            body: null,
            sentAt: null,
            error: null,
            messageId: null,
            opened: false,
            openedAt: null,
            openCount: 0,
            clicked: false,
            clickedAt: null,
            clickCount: 0,
            ctaClicked: false,
            ctaClickedAt: null,
            docClicked: false,
            docClickedAt: null,
            replyBody: null,
            replySubject: null,
            repliedAt: null,
          },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to reset status:', error);
    return NextResponse.json(
      { error: 'Failed to reset status' },
      { status: 500 }
    );
  }
}
