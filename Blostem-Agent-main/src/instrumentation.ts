/**
 * Next.js startup hook. Runs once when the server boots (dev and production).
 * We use it to auto-start the cloudflared tunnel so email open/click tracking
 * gets a public URL without the user configuring anything.
 *
 * Only runs in the Node.js runtime (never Edge), and is a no-op if cloudflared
 * is unavailable — the app keeps working, tracking just stays off.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  // On Vercel (or any serverless host) we can't spawn a tunnel, and we don't
  // need one — the platform already serves the app on a public URL.
  if (process.env.VERCEL || process.env.DISABLE_TUNNEL) return;
  try {
    const { startTunnel } = await import('@/lib/tunnel');
    startTunnel();
  } catch (err) {
    console.error('[Instrumentation] Failed to start tracking tunnel:', err);
  }
}
