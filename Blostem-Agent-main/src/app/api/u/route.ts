import { NextRequest, NextResponse } from 'next/server';
import { verifyUnsubscribeToken, unsubscribeContact } from '@/lib/unsubscribe';

export const dynamic = 'force-dynamic';

/**
 * Unsubscribe endpoint.
 *  - POST  (RFC 8058 one-click): mail providers POST `List-Unsubscribe=One-Click`
 *          here with NO auth and NO confirmation page. Must suppress and return 200.
 *  - GET   (human click from the email footer): suppress, then show a simple page.
 */

function page(title: string, message: string, ok: boolean): NextResponse {
  const color = ok ? '#059669' : '#dc2626';
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title></head>
<body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;">
  <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:40px 36px;max-width:420px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.06);">
    <div style="font-size:40px;line-height:1;margin-bottom:12px;">${ok ? '✅' : '⚠️'}</div>
    <h1 style="font-size:18px;color:${color};margin:0 0 8px;">${title}</h1>
    <p style="font-size:14px;color:#475569;margin:0;line-height:1.6;">${message}</p>
  </div>
</body></html>`;
  return new NextResponse(html, {
    status: ok ? 200 : 400,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export async function POST(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('t') || '';
  const contactId = await verifyUnsubscribeToken(token);
  if (contactId) {
    await unsubscribeContact(contactId);
  }
  // One-click MUST return 200 regardless, with no body needed.
  return new NextResponse(null, { status: 200 });
}

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('t') || '';
  const contactId = await verifyUnsubscribeToken(token);
  if (!contactId) {
    return page('Invalid unsubscribe link', 'This unsubscribe link is invalid or has expired.', false);
  }
  const result = await unsubscribeContact(contactId);
  if (!result) {
    return page('Already removed', 'This contact is no longer on our list.', true);
  }
  const safeEmail = result.email.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return page(
    'You have been unsubscribed',
    `${safeEmail} has been removed and will not receive further emails from us.`,
    true
  );
}
