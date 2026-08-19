import { NextResponse } from 'next/server';
import { resolveTracking, getTunnelState, isEmailSafeTrackingUrl } from '@/lib/tracking-url';
import { getUserId } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Reports whether live open/click tracking is active and where the public URL
 * comes from. Used by the Settings UI to show an auto status (so the user never
 * has to paste a URL).
 */
export async function GET(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const requestUrl = host ? `${proto}://${host}` : null;

  const resolved = await resolveTracking(userId, requestUrl);
  const tunnel = getTunnelState();

  // `active` means emails actually get a tracking pixel — only true for email-safe
  // (non-ephemeral) URLs. The quick trycloudflare.com tunnel intentionally does NOT
  // count: its domain is blocklisted by spam filters, so we never embed it in emails.
  const emailSafe = isEmailSafeTrackingUrl(resolved.url);

  return NextResponse.json({
    active: emailSafe,
    url: emailSafe ? resolved.url : null,
    source: resolved.source, // 'env' | 'tunnel' | 'manual' | 'none'
    // Whether any tunnel is alive (even if not email-safe); used so the UI can
    // distinguish "tunnel connected but wrong domain" from "no tunnel at all".
    tunnelConnected: tunnel.state === 'connected',
    tunnel: {
      state: tunnel.state, // 'idle' | 'starting' | 'connected' | 'disabled' | 'error'
      provider: tunnel.provider,
      lastError: tunnel.lastError,
    },
  });
}
