import { NextResponse } from 'next/server';
import { promises as dns } from 'dns';
import { getUserId } from '@/lib/session';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// These providers manage SPF/DKIM/DMARC internally — no DNS action needed.
const MANAGED_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
  'yahoo.com', 'yahoo.co.uk', 'yahoo.co.in',
  'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'protonmail.com', 'proton.me',
]);

async function checkSpf(domain: string): Promise<{ pass: boolean; record: string | null }> {
  try {
    const records = await dns.resolveTxt(domain);
    const spf = records.flat().find(r => r.startsWith('v=spf1')) ?? null;
    return { pass: !!spf, record: spf };
  } catch {
    return { pass: false, record: null };
  }
}

// Try the most common DKIM selectors; first hit wins.
const DKIM_SELECTORS = [
  'google', 'mail', 'default', 'selector1', 'selector2',
  'zoho', 'dkim', 'smtp', 'key1', 'k1', 'protonmail', 'mailjet',
];

async function checkDkim(domain: string): Promise<{ pass: boolean; selector: string | null }> {
  const checks = DKIM_SELECTORS.map(async (sel) => {
    try {
      const records = await dns.resolveTxt(`${sel}._domainkey.${domain}`);
      return records.length > 0 ? sel : null;
    } catch {
      return null;
    }
  });
  const results = await Promise.all(checks);
  const found = results.find(Boolean) ?? null;
  return { pass: !!found, selector: found };
}

async function checkDmarc(domain: string): Promise<{ pass: boolean; record: string | null; policy: string | null }> {
  try {
    const records = await dns.resolveTxt(`_dmarc.${domain}`);
    const rec = records.flat().find(r => r.startsWith('v=DMARC1')) ?? null;
    if (!rec) return { pass: false, record: null, policy: null };
    const policy = rec.match(/p=(\w+)/)?.[1] ?? 'none';
    return { pass: true, record: rec, policy };
  } catch {
    return { pass: false, record: null, policy: null };
  }
}

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const config = await db.appConfig.findUnique({ where: { userId } });
    const emailUser = config?.emailUser || '';
    const domain = emailUser.toLowerCase().split('@')[1] ?? '';
    if (!domain) return NextResponse.json({ error: 'No sending email configured.' }, { status: 400 });

    const isManaged = MANAGED_DOMAINS.has(domain);

    if (isManaged) {
      return NextResponse.json({
        domain,
        isManaged: true,
        spf:   { pass: true, managed: true, record: null },
        dkim:  { pass: true, managed: true, selector: null },
        dmarc: { pass: true, managed: true, record: null, policy: null },
      });
    }

    const [spf, dkim, dmarc] = await Promise.all([
      checkSpf(domain),
      checkDkim(domain),
      checkDmarc(domain),
    ]);

    return NextResponse.json({ domain, isManaged: false, spf, dkim, dmarc });
  } catch (err) {
    console.error('[dns-check]', err);
    return NextResponse.json({ error: 'DNS check failed' }, { status: 500 });
  }
}
