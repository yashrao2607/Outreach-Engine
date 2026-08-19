import { spawn, type ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import {
  setTunnelUrl,
  setTunnelStatus,
  getTunnelState,
  isPublicHttpUrl,
  normalizeBaseUrl,
} from '@/lib/tracking-url';

/**
 * Auto-starts a cloudflared tunnel so the app gets a public URL for email
 * open/click tracking WITHOUT the user ever pasting one.
 *
 * Modes:
 *  - Quick tunnel (default, zero-config): `cloudflared tunnel --url <local>`
 *    -> a free https://*.trycloudflare.com URL, parsed from cloudflared output.
 *  - Named tunnel (production, stable URL): set CLOUDFLARE_TUNNEL_TOKEN and
 *    TRACKING_BASE_URL -> `cloudflared tunnel run --token <token>`. The URL
 *    never rotates, so links in already-sent emails never break.
 *
 * Disable entirely with DISABLE_TUNNEL=1 (e.g. when pointing every copy at a
 * central server via TRACKING_BASE_URL). If cloudflared is missing the app
 * still runs perfectly; tracking just stays off until a URL is available.
 */

const QUICK_URL_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;

const globalForProc = globalThis as unknown as {
  __mailTunnelStarted?: boolean;
  __mailTunnelProc?: ChildProcess | null;
  __mailTunnelRestartTimer?: ReturnType<typeof setTimeout> | null;
  __mailTunnelRetryMs?: number;
};

function log(msg: string): void {
  console.log(`[Tunnel ${new Date().toISOString()}] ${msg}`);
}

function resolveCloudflaredPath(): string | null {
  const candidates = [
    process.env.CLOUDFLARED_PATH,
    'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
    'C:\\Program Files\\cloudflared\\cloudflared.exe',
    '/usr/local/bin/cloudflared',
    '/usr/bin/cloudflared',
    '/opt/homebrew/bin/cloudflared',
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      if (existsSync(candidate)) return candidate;
    } catch {
      // ignore and keep checking
    }
  }
  return null; // fall back to a bare PATH lookup ('cloudflared')
}

export function startTunnel(): void {
  // Explicitly disabled.
  if (process.env.DISABLE_TUNNEL === '1' || process.env.DISABLE_TUNNEL === 'true') {
    log('Tunnel disabled via DISABLE_TUNNEL. Open/click tracking uses TRACKING_BASE_URL/manual override if set.');
    setTunnelStatus({ state: 'disabled', provider: 'external' });
    return;
  }

  // A central/external tracking host is configured and we are not asked to run
  // a named tunnel -> no local tunnel needed.
  if (isPublicHttpUrl(process.env.TRACKING_BASE_URL) && !process.env.CLOUDFLARE_TUNNEL_TOKEN) {
    log(`Using external TRACKING_BASE_URL=${process.env.TRACKING_BASE_URL} — skipping local tunnel.`);
    setTunnelStatus({ state: 'disabled', provider: 'external' });
    return;
  }

  if (globalForProc.__mailTunnelStarted) return; // idempotent across HMR reloads
  globalForProc.__mailTunnelStarted = true;
  globalForProc.__mailTunnelRetryMs = 5000;
  spawnTunnel();
}

function spawnTunnel(): void {
  const bin = resolveCloudflaredPath();
  const cmd = bin || 'cloudflared';
  const useShell = !bin && process.platform === 'win32';

  const token = process.env.CLOUDFLARE_TUNNEL_TOKEN;
  const port = process.env.PORT || '3000';
  const named = Boolean(token);

  const args = named
    ? ['tunnel', 'run', '--token', token as string]
    : ['tunnel', '--url', `http://localhost:${port}`];

  setTunnelStatus({ state: 'starting', lastError: null });
  log(`Starting cloudflared (${named ? 'named' : 'quick'} tunnel) via "${cmd}"...`);

  let proc: ChildProcess;
  try {
    proc = spawn(cmd, args, { shell: useShell, windowsHide: true });
  } catch (err) {
    handleFailure(err instanceof Error ? err.message : String(err));
    return;
  }
  globalForProc.__mailTunnelProc = proc;

  if (named) {
    // For a named tunnel the public URL is the configured hostname.
    if (isPublicHttpUrl(process.env.TRACKING_BASE_URL)) {
      setTunnelUrl(normalizeBaseUrl(process.env.TRACKING_BASE_URL as string), 'cloudflare-named');
      log(`Named tunnel public URL: ${process.env.TRACKING_BASE_URL}`);
    } else {
      log('WARNING: CLOUDFLARE_TUNNEL_TOKEN is set but TRACKING_BASE_URL is missing/invalid. Set TRACKING_BASE_URL to your tunnel hostname (e.g. https://track.yourdomain.com).');
    }
  }

  const onData = (data: Buffer) => {
    const text = data.toString();
    if (!named) {
      const match = text.match(QUICK_URL_RE);
      if (match && getTunnelState().liveUrl !== match[0]) {
        setTunnelUrl(match[0], 'cloudflare-quick');
        globalForProc.__mailTunnelRetryMs = 5000; // reset backoff on success
        log(`Live tracking tunnel ready: ${match[0]}`);
      }
    } else if (/Registered tunnel connection|connection.+registered/i.test(text)) {
      setTunnelStatus({ state: 'connected' });
    }
  };

  proc.stdout?.on('data', onData);
  proc.stderr?.on('data', onData);

  proc.on('error', (err) => {
    handleFailure(err.message);
  });

  proc.on('close', (code) => {
    globalForProc.__mailTunnelProc = null;
    setTunnelStatus({ state: 'error', liveUrl: null });
    log(`cloudflared exited (code ${code}).`);
    scheduleRestart();
  });
}

function handleFailure(message: string): void {
  globalForProc.__mailTunnelProc = null;
  setTunnelStatus({ state: 'error', lastError: message, liveUrl: null });
  if (/ENOENT/i.test(message)) {
    log(
      'cloudflared not found — live open/click tracking is OFF (emails still send normally with working links). ' +
        'Install cloudflared (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) ' +
        'or set TRACKING_BASE_URL to a public host.'
    );
    globalForProc.__mailTunnelRetryMs = 60000; // don't hammer if the binary is absent
  } else {
    log(`cloudflared error: ${message}`);
  }
  scheduleRestart();
}

function scheduleRestart(): void {
  if (globalForProc.__mailTunnelRestartTimer) return; // a restart is already queued
  const delay = globalForProc.__mailTunnelRetryMs || 5000;
  log(`Restarting tunnel in ${Math.round(delay / 1000)}s...`);
  globalForProc.__mailTunnelRestartTimer = setTimeout(() => {
    globalForProc.__mailTunnelRestartTimer = null;
    globalForProc.__mailTunnelRetryMs = Math.min((globalForProc.__mailTunnelRetryMs || 5000) * 1.5, 60000);
    spawnTunnel();
  }, delay);
}
