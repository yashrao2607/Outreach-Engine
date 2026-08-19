import { db } from '@/lib/db';

/**
 * Central resolver for the PUBLIC tracking base URL.
 *
 * Email open-pixels and click-redirect links are loaded from the recipient's
 * inbox, somewhere on the public internet. `localhost:3000` is invisible to
 * them, so tracking needs a publicly reachable address.
 *
 * Resolution priority (first public URL wins):
 *   1. TRACKING_BASE_URL env  -> central server / named-tunnel canonical URL
 *   2. live auto tunnel (in-memory, set by the cloudflared tunnel manager)
 *   3. manual override saved in DB AppConfig.appUrl (advanced)
 *   4. none -> caller degrades gracefully (send plain links, no pixel)
 *
 * The buyer never has to type anything: (2) happens automatically.
 */

export type TunnelRuntimeState = {
  /** Current live tunnel URL (in-memory only; never persisted). */
  liveUrl: string | null;
  /** 'cloudflare-quick' | 'cloudflare-named' | 'external' | null */
  provider: string | null;
  /** lifecycle of the tunnel process */
  state: 'idle' | 'starting' | 'connected' | 'disabled' | 'error';
  lastError: string | null;
};

const globalForTunnel = globalThis as unknown as {
  __mailTunnelState?: TunnelRuntimeState;
};

function runtime(): TunnelRuntimeState {
  if (!globalForTunnel.__mailTunnelState) {
    globalForTunnel.__mailTunnelState = {
      liveUrl: null,
      provider: null,
      state: 'idle',
      lastError: null,
    };
  }
  return globalForTunnel.__mailTunnelState;
}

export function getTunnelState(): TunnelRuntimeState {
  return runtime();
}

export function setTunnelUrl(url: string | null, provider: string | null): void {
  const s = runtime();
  s.liveUrl = url;
  s.provider = provider;
  if (url) s.state = 'connected';
}

export function setTunnelStatus(partial: Partial<TunnelRuntimeState>): void {
  Object.assign(runtime(), partial);
}

const LOCAL_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
]);

/**
 * True only for an http(s) URL with a real, publicly resolvable hostname.
 * Rejects localhost/loopback and bare hostnames (no dot) so we never bake an
 * unreachable address into an outgoing email.
 */
export function isPublicHttpUrl(value: string | null | undefined): boolean {
  if (!value || typeof value !== 'string') return false;
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  if (LOCAL_HOSTS.has(host)) return false;
  if (!host.includes('.')) return false; // require an FQDN (rejects LAN names)
  return true;
}

export function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

/**
 * Ephemeral dev-tunnel / shortener domains that must NEVER appear in outgoing
 * email. These hostnames are heavily abused for phishing/malware and are
 * blocklisted, so stamping them into tracking pixels or rewritten links is a
 * near-guaranteed trip to the spam folder. Tracking only activates on a real,
 * branded domain.
 */
const EPHEMERAL_TUNNEL_SUFFIXES = [
  'trycloudflare.com',
  'lhr.life',
  'localhost.run',
  'ngrok.io',
  'ngrok-free.app',
  'ngrok.app',
  'ngrok.dev',
  'serveo.net',
  'loca.lt',
  'localto.net',
  'telebit.io',
  'pagekite.me',
  'cfargotunnel.com',
];

export function isEphemeralTunnelHost(value: string | null | undefined): boolean {
  if (!value) return false;
  let host: string;
  try {
    host = new URL(value.trim()).hostname.toLowerCase();
  } catch {
    return false;
  }
  return EPHEMERAL_TUNNEL_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`)
  );
}

/**
 * A URL safe to embed in cold email: public, http(s), branded (NOT a tunnel
 * domain). Use this — not isPublicHttpUrl — to decide whether to add a tracking
 * pixel or rewrite links.
 */
export function isEmailSafeTrackingUrl(value: string | null | undefined): boolean {
  return isPublicHttpUrl(value) && !isEphemeralTunnelHost(value);
}

/**
 * The base URL to use for email tracking pixels / click links, or null when no
 * deliverability-safe (branded) URL is available. The auto cloudflared tunnel
 * is deliberately NOT used here — its *.trycloudflare.com host would hurt
 * deliverability — so by default this returns null and emails send clean.
 */
export async function getEmailTrackingBaseUrl(userId?: string | null, requestUrl?: string | null): Promise<string | null> {
  const { url } = await resolveTracking(userId, requestUrl);
  return isEmailSafeTrackingUrl(url) ? url : null;
}

export type ResolvedTracking = {
  url: string | null;
  source: 'env' | 'tunnel' | 'manual' | 'none';
};

export async function resolveTracking(userId?: string | null, requestUrl?: string | null): Promise<ResolvedTracking> {
  // 1. Explicit env override (central server / named-tunnel hostname)
  const envUrl = process.env.TRACKING_BASE_URL;
  if (isPublicHttpUrl(envUrl)) {
    return { url: normalizeBaseUrl(envUrl as string), source: 'env' };
  }

  // 2. Request header URL (dynamic detection from incoming HTTP headers)
  if (isPublicHttpUrl(requestUrl)) {
    return { url: normalizeBaseUrl(requestUrl as string), source: 'env' };
  }

  // 1b. On Vercel the deployment already has a public URL — use it.
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelHost) {
    const vercelUrl = `https://${vercelHost.replace(/^https?:\/\//, '')}`;
    if (isPublicHttpUrl(vercelUrl)) {
      return { url: normalizeBaseUrl(vercelUrl), source: 'env' };
    }
  }

  // 2b. Live auto tunnel (in-memory)
  const live = runtime().liveUrl;
  if (isPublicHttpUrl(live)) {
    return { url: normalizeBaseUrl(live as string), source: 'tunnel' };
  }

  // 3. Manual override persisted in the DB (advanced / optional)
  if (userId) {
    try {
      const config = await db.appConfig.findUnique({ where: { userId } });
      if (config && isPublicHttpUrl(config.appUrl)) {
        return { url: normalizeBaseUrl(config.appUrl), source: 'manual' };
      }
    } catch {
      // DB not reachable -> fall through
    }
  }

  // 4. Default production fallback
  return { url: 'https://jobapplicationshit.vercel.app', source: 'env' };
}

export async function getTrackingBaseUrl(userId?: string | null, requestUrl?: string | null): Promise<string | null> {
  return (await resolveTracking(userId, requestUrl)).url;
}
