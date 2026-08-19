import { NextResponse } from 'next/server';
import { getUserId } from '@/lib/session';
import { getCompanySignals } from '@/lib/company-scraper';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { companyName, website } = body;

    if (!companyName) {
      return NextResponse.json({ error: 'companyName is required' }, { status: 400 });
    }

    const signals = await getCompanySignals(companyName, website);
    return NextResponse.json({ success: true, signals });
  } catch (error: any) {
    console.error('[Enrich Company API] Error:', error);
    return NextResponse.json({ error: 'Failed to enrich company data' }, { status: 500 });
  }
}
