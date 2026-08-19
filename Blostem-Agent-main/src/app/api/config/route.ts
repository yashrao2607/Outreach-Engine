import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getUserId } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let config = await db.appConfig.findUnique({ where: { userId } });
    if (!config) {
      config = await db.appConfig.create({ data: { userId } });
    }
    // Redact secrets — client only needs to know if they're set, not the values
    const { emailPass, geminiApiKey, groqApiKey, tavilyApiKey, firecrawlApiKey, hunterApiKey, ...safeConfig } = config;
    return NextResponse.json({
      ...safeConfig,
      emailPass: emailPass ? '••••••••' : '',
      geminiApiKey: geminiApiKey ? '••••••••' : '',
      groqApiKey: groqApiKey ? '••••••••' : '',
      tavilyApiKey: tavilyApiKey ? '••••••••' : '',
      firecrawlApiKey: firecrawlApiKey ? '••••••••' : '',
      hunterApiKey: hunterApiKey ? '••••••••' : '',
    });
  } catch (error) {
    console.error('Failed to get config:', error);
    return NextResponse.json(
      { error: 'Failed to get config' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const REDACTED = '••••••••';
    const sensitiveField = (v: unknown) =>
      v && typeof v === 'string' && v !== REDACTED ? v : undefined;

    const config = await db.appConfig.upsert({
      where: { userId },
      update: {
        emailUser: body.emailUser ?? undefined,
        emailPass: sensitiveField(body.emailPass),
        geminiApiKey: sensitiveField(body.geminiApiKey),
        groqApiKey: sensitiveField(body.groqApiKey),
        aiProvider: body.aiProvider ?? undefined,
        candidateName: body.candidateName ?? undefined,
        candidateEmail: body.candidateEmail ?? undefined,
        candidatePhone: body.candidatePhone ?? undefined,
        candidateLinkedin: body.candidateLinkedin ?? undefined,
        companyWebsite: body.companyWebsite ?? undefined,
        candidateCollege: body.candidateCollege ?? undefined,
        candidateDegree: body.candidateDegree ?? undefined,
        candidateSkills: body.candidateSkills ?? undefined,
        candidateHighlights: body.candidateHighlights ?? undefined,
        customInstructions: body.customInstructions ?? undefined,
        candidateCtaLink: body.candidateCtaLink ?? undefined,
        candidateDocLink: body.candidateDocLink ?? undefined,
        appUrl: body.appUrl ?? undefined,
        includeWebsite: body.includeWebsite !== undefined ? body.includeWebsite : undefined,
        includeLinkedin: body.includeLinkedin !== undefined ? body.includeLinkedin : undefined,
        tavilyApiKey: sensitiveField(body.tavilyApiKey),
        firecrawlApiKey: sensitiveField(body.firecrawlApiKey),
        hunterApiKey: sensitiveField(body.hunterApiKey),
        companyAddress: body.companyAddress ?? undefined,
        replyToEmail: body.replyToEmail ?? undefined,
        enableTracking: body.enableTracking !== undefined ? body.enableTracking : undefined,
        dailySendLimit: body.dailySendLimit ?? undefined,
        minSendDelaySec: body.minSendDelaySec ?? undefined,
        maxSendDelaySec: body.maxSendDelaySec ?? undefined,
        enableFollowUps: body.enableFollowUps !== undefined ? body.enableFollowUps : undefined,
        followUp1DelayDays: body.followUp1DelayDays !== undefined ? Number(body.followUp1DelayDays) : undefined,
        followUp2DelayDays: body.followUp2DelayDays !== undefined ? Number(body.followUp2DelayDays) : undefined,
        maxFollowUpSteps: body.maxFollowUpSteps !== undefined ? Number(body.maxFollowUpSteps) : undefined,
        enableAbTesting: body.enableAbTesting !== undefined ? body.enableAbTesting : undefined,
        apiAuthToken: body.apiAuthToken ?? undefined,
      },
      create: {
        userId,
        emailUser: body.emailUser ?? '',
        emailPass: body.emailPass ?? '',
        geminiApiKey: body.geminiApiKey ?? '',
        groqApiKey: body.groqApiKey ?? '',
        aiProvider: body.aiProvider ?? 'groq',
        candidateName: body.candidateName ?? '',
        candidateEmail: body.candidateEmail ?? '',
        candidatePhone: body.candidatePhone ?? '',
        candidateLinkedin: body.candidateLinkedin ?? '',
        companyWebsite: body.companyWebsite ?? '',
        candidateCollege: body.candidateCollege ?? '',
        candidateDegree: body.candidateDegree ?? '',
        candidateSkills: body.candidateSkills ?? '[]',
        candidateHighlights: body.candidateHighlights ?? '[]',
        customInstructions: body.customInstructions ?? '',
        candidateCtaLink: body.candidateCtaLink ?? '',
        candidateDocLink: body.candidateDocLink ?? '',
        appUrl: body.appUrl ?? '',
        includeWebsite: body.includeWebsite ?? true,
        includeLinkedin: body.includeLinkedin ?? true,
        tavilyApiKey: body.tavilyApiKey ?? '',
        firecrawlApiKey: body.firecrawlApiKey ?? '',
        hunterApiKey: body.hunterApiKey ?? '',
        companyAddress: body.companyAddress ?? '',
        replyToEmail: body.replyToEmail ?? '',
        enableTracking: body.enableTracking ?? true,
        dailySendLimit: body.dailySendLimit ?? 40,
        minSendDelaySec: body.minSendDelaySec ?? 45,
        maxSendDelaySec: body.maxSendDelaySec ?? 120,
        enableFollowUps: body.enableFollowUps ?? true,
        followUp1DelayDays: body.followUp1DelayDays ? Number(body.followUp1DelayDays) : 3,
        followUp2DelayDays: body.followUp2DelayDays ? Number(body.followUp2DelayDays) : 4,
        maxFollowUpSteps: body.maxFollowUpSteps ? Number(body.maxFollowUpSteps) : 2,
        enableAbTesting: body.enableAbTesting ?? true,
        apiAuthToken: body.apiAuthToken ?? '',
      },
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error('Failed to update config:', error);
    return NextResponse.json(
      { error: 'Failed to update config' },
      { status: 500 }
    );
  }
}
