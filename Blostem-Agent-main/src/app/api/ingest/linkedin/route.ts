import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getUserId } from '@/lib/session';
import { getCompanySignals } from '@/lib/company-scraper';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function POST(req: Request) {
  try {
    let userId = await getUserId();

    // Check API token from headers or query param if session is not active
    const authHeader = req.headers.get('authorization') || req.headers.get('x-api-key');
    const url = new URL(req.url);
    const tokenQuery = url.searchParams.get('token');
    const providedToken = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : tokenQuery?.trim();

    let config: any = null;

    if (providedToken) {
      config = await db.appConfig.findFirst({
        where: { apiAuthToken: providedToken },
      });
      if (config) {
        userId = config.userId;
      }
    }

    if (!userId) {
      // Fallback to first user in system if single-tenant environment
      config = await db.appConfig.findFirst();
      if (config && config.userId) {
        userId = config.userId;
      } else {
        return NextResponse.json(
          { error: 'Unauthorized: Invalid or missing API Auth Token' },
          { status: 401, headers: CORS_HEADERS }
        );
      }
    } else if (!config) {
      config = await db.appConfig.findUnique({ where: { userId } });
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized: User not identified' },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const body = await req.json();
    let { name, company, title, email, linkedinUrl } = body;

    if (!name && !company) {
      return NextResponse.json(
        { error: 'At least name or company must be provided' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const cleanName = (name || 'Hiring Manager').trim();
    const cleanCompany = (company || 'Target Team').trim();
    const cleanTitle = (title || 'Recruiter / Talent Acquisition').trim();

    // If email is not explicitly provided, construct clean contact identifier
    if (!email || !email.includes('@')) {
      const nameSlug = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '.');
      const compSlug = cleanCompany.toLowerCase().replace(/[^a-z0-9]/g, '');
      email = `${nameSlug}@${compSlug || 'company'}.com`;
    }

    // Check if contact already exists
    let contact = await db.hrContact.findFirst({
      where: {
        userId,
        email: email.trim().toLowerCase(),
      },
    });

    if (contact) {
      contact = await db.hrContact.update({
        where: { id: contact.id },
        data: {
          name: cleanName,
          company: cleanCompany,
          title: cleanTitle,
          status: contact.status === 'sent' || contact.status === 'replied' ? contact.status : 'pending',
        },
      });
    } else {
      contact = await db.hrContact.create({
        data: {
          userId,
          name: cleanName,
          email: email.trim().toLowerCase(),
          company: cleanCompany,
          title: cleanTitle,
          status: 'pending',
          abVariant: Math.random() > 0.5 ? 'A' : 'B',
        },
      });
    }

    // Auto-enrich company tech stack asynchronously in the background
    getCompanySignals(cleanCompany).catch((e) => console.warn('[LinkedIn Ingest] Background enrichment error:', e));

    return NextResponse.json(
      {
        success: true,
        message: `Ingested ${cleanName} @ ${cleanCompany} into Outreach Pipeline`,
        contact,
      },
      { headers: CORS_HEADERS }
    );
  } catch (error: any) {
    console.error('[LinkedIn Ingest API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to ingest LinkedIn contact' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
