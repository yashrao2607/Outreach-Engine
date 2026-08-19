import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id')?.trim();
  const targetUrl = searchParams.get('url');
  const type = searchParams.get('type') || 'general'; // cta | doc | general

  if (id && targetUrl) {
    try {
      const contact = await db.hrContact.findUnique({ where: { id } });

      if (contact) {
        const updateData: any = {
          clicked: true,
          clickCount: { increment: 1 },
          opened: true,
        };
        if (!contact.clickedAt) {
          updateData.clickedAt = new Date();
        }
        if (!contact.openedAt) {
          updateData.openedAt = new Date();
        }
        if (contact.openCount === 0) {
          updateData.openCount = 1;
        }

        if (type === 'cta') {
          updateData.ctaClicked = true;
          if (!contact.ctaClickedAt) {
            updateData.ctaClickedAt = new Date();
          }
        } else if (type === 'doc') {
          updateData.docClicked = true;
          if (!contact.docClickedAt) {
            updateData.docClickedAt = new Date();
          }
        }

        await db.hrContact.update({
          where: { id },
          data: updateData,
        });

        console.log(`[Tracking] Click tracked (${type}) for ${contact.name} (${contact.email}) to ${targetUrl}`);
      }
    } catch (error) {
      console.error('[Tracking] Failed to track link click:', error);
    }
  }

  // Redirect to destination URL
  if (targetUrl) {
    try {
      const decodedUrl = decodeURIComponent(targetUrl).trim().replace(/["'`;).,\]}>!?]+$/, '');
      if (/^https?:\/\//i.test(decodedUrl)) {
        return NextResponse.redirect(decodedUrl);
      }
    } catch (e) {
      console.error('[Tracking] Redirect failed:', e);
    }
    return NextResponse.redirect(new URL('/', request.url).toString());
  }

  const homeUrl = new URL('/', request.url).toString();
  return NextResponse.redirect(homeUrl);
}
