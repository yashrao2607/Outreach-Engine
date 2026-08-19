import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Transparent 1x1 GIF
const GIF_BUFFER = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

const NO_CACHE_HEADERS = {
  'Content-Type': 'image/gif',
  'Content-Length': GIF_BUFFER.length.toString(),
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Surrogate-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
};

const BOT_PATTERNS = [
  'spider',
  'crawler',
  'preview',
  'prefetch',
  'curl',
  'wget',
  'python',
  'go-http',
  'scanner',
  'proofpoint',
  'barracuda',
  'safelinks',
  'mimecast',
  'headless',
  'postman',
  'axios',
  'virustotal',
  'pingdom',
  'uptimerobot',
];

function isAutomatedBot(request: NextRequest): boolean {
  const ua = (request.headers.get('user-agent') || '').toLowerCase();
  const purpose =
    request.headers.get('purpose') ||
    request.headers.get('x-purpose') ||
    request.headers.get('sec-purpose') ||
    request.headers.get('x-moz');

  if (purpose && (purpose.includes('prefetch') || purpose.includes('preview'))) {
    return true;
  }

  for (const pattern of BOT_PATTERNS) {
    if (ua.includes(pattern)) {
      return true;
    }
  }

  return false;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id')?.trim();

    if (id) {
      // 1. Filter out known automated prefetch bot crawlers
      if (isAutomatedBot(request)) {
        return new NextResponse(GIF_BUFFER, { status: 200, headers: NO_CACHE_HEADERS });
      }

      const contact = await db.hrContact.findUnique({ where: { id } });

      // 2. Track contacts that have been sent
      if (contact && (contact.sentAt || contact.status === 'sent' || contact.status === 'replied')) {
        const now = Date.now();
        const timeSinceLastOpenMs = contact.openedAt
          ? now - new Date(contact.openedAt).getTime()
          : Infinity;

        // Debounce: 5 seconds (allows multiple reading sessions to count while ignoring duplicate rapid render bursts)
        if (timeSinceLastOpenMs > 5000) {
          const updateData: any = {
            opened: true,
            openCount: { increment: 1 },
            openedAt: new Date(),
          };

          await db.hrContact.update({
            where: { id },
            data: updateData,
          });

          console.log(`[Tracking] Email open registered for ${contact.name} (${contact.email}) | New total: ${(contact.openCount || 0) + 1}`);
        }
      }
    }
  } catch (error) {
    console.error('[Tracking] Failed to track email open:', error);
  }

  return new NextResponse(GIF_BUFFER, {
    status: 200,
    headers: NO_CACHE_HEADERS,
  });
}
