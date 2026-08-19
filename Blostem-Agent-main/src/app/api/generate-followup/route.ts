import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getUserId } from '@/lib/session';
import { rateLimit } from '@/lib/rate-limit';

export const maxDuration = 60;

const DEFAULT_GROQ_KEY = process.env.GROQ_API_KEY || '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';

const GROQ_MAX_REQ_PER_MIN = 29;
const GROQ_WINDOW_MS = 60 * 1000;
const groqRequestTimestamps: number[] = [];

async function acquireGroqSlot(): Promise<void> {
  while (true) {
    const now = Date.now();
    while (groqRequestTimestamps.length > 0 && groqRequestTimestamps[0] <= now - GROQ_WINDOW_MS) {
      groqRequestTimestamps.shift();
    }
    if (groqRequestTimestamps.length < GROQ_MAX_REQ_PER_MIN) {
      groqRequestTimestamps.push(now);
      return;
    }
    const oldestTimestamp = groqRequestTimestamps[0];
    const waitTime = Math.max(100, oldestTimestamp + GROQ_WINDOW_MS - now + 50);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }
}

async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

function parseEmailJson(text: string): { subject: string; body: string } | null {
  try {
    const parsed = JSON.parse(text);
    if (parsed.subject && parsed.body) return parsed;
  } catch {}

  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1].trim());
      if (parsed.subject && parsed.body) return parsed;
    } catch {}
  }

  const jsonMatch = text.match(/\{[\s\S]*"subject"[\s\S]*"body"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.subject && parsed.body) return parsed;
    } catch {}
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const ip = (request.headers.get('x-forwarded-for') || '127.0.0.1').split(',')[0].trim();
    if (!rateLimit(ip, 35, 60 * 1000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { hrContactId, step = 1, feedback } = await request.json();
    if (!hrContactId) {
      return NextResponse.json({ error: 'hrContactId is required' }, { status: 400 });
    }

    const hrContact = await db.hrContact.findFirst({
      where: { id: hrContactId, userId },
    });
    if (!hrContact) {
      return NextResponse.json({ error: 'HR contact not found' }, { status: 404 });
    }

    const config = await db.appConfig.findUnique({ where: { userId } });
    if (!config) {
      return NextResponse.json({ error: 'Profile configuration missing' }, { status: 400 });
    }

    const candidateRole = config.candidateDegree || 'Software Engineer';
    const candidateCollege = config.candidateCollege || '';

    function parseListField(raw: string): string[] {
      if (!raw || !raw.trim()) return [];
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter((s: unknown) => typeof s === 'string' && s.trim());
      } catch {}
      return raw.split('\n').map((s) => s.trim()).filter(Boolean);
    }

    const skills = parseListField(config.candidateSkills);
    const highlights = parseListField(config.candidateHighlights);
    const skillsStr = skills.length > 0 ? skills.join(', ') : config.candidateSkills || 'Full Stack Development';
    const topHighlight = highlights[0] || 'proven project experience in scalable application development';

    const signatureLines = [
      'Best regards,',
      '',
      config.candidateName,
      candidateCollege ? `${candidateRole} | ${candidateCollege}` : candidateRole,
    ];
    if (config.includeLinkedin && config.candidateLinkedin) {
      signatureLines.push(`LinkedIn: ${config.candidateLinkedin}`);
    }
    if (config.includeWebsite && config.companyWebsite) {
      signatureLines.push(`Portfolio: ${config.companyWebsite}`);
    }
    if (config.candidatePhone) {
      signatureLines.push(`Phone: ${config.candidatePhone}`);
    }
    const signatureTemplate = signatureLines.join('\n');

    // Inherit base subject for thread continuity
    let originalSubject = hrContact.subject?.trim() || `${candidateRole} Opportunity — ${config.candidateName}`;
    if (originalSubject.toLowerCase().startsWith('re:')) {
      originalSubject = originalSubject.substring(3).trim();
    }
    const threadSubject = `Re: ${originalSubject}`;

    const isSecondFollowUp = Number(step) === 2;

    const systemPrompt = `You are a cold job application email expert writing a polite, concise FOLLOW-UP email from a candidate to a recruiter or hiring manager at a company.

CRITICAL RULES:
1. PURPOSE: Follow-up on a previously sent job application for ${candidateRole} roles at ${hrContact.company}.
2. TONE: Courteous, humble, direct, and conversational. Never pushy or entitled.
3. FORMATTING: Plain text only. NO markdown, NO asterisks, NO bullet points.
4. STRUCTURE:
   - Greeting: "Hi ${hrContact.name || 'Team'},"
   - Context (1 sentence): Briefly reference the previous email sent earlier regarding open ${candidateRole} opportunities.
   - Value / Highlight (${isSecondFollowUp ? '1 sentence' : '1-2 sentences'}): ${
     isSecondFollowUp
       ? `Reiterate passion for ${hrContact.company} and mention resume/portfolio (${config.candidateDocLink || config.companyWebsite || 'attached'}).`
       : `Mention a specific project/skill (${topHighlight}) and eager interest in contributing to their engineering team.`
   }
   - Call-To-Action (1 sentence): ${
     isSecondFollowUp
       ? `Ask if they have any current or upcoming openings, or if they could point you to the right hiring manager.`
       : `Ask if they have 5-10 minutes this week for a brief introductory conversation${config.candidateCtaLink ? ` (${config.candidateCtaLink})` : ''}.`
   }
   - Signature MUST be:
${signatureTemplate}
5. LENGTH: Strictly 40 to 65 words total.
6. OUTPUT: Return ONLY a valid JSON object: {"subject": "${threadSubject}", "body": "..."}`;

    const userPrompt = `Generate a ${isSecondFollowUp ? 'final polite follow-up (Step 2)' : 'gentle follow-up (Step 1)'} email to ${hrContact.name || 'Recruiter'} at ${hrContact.company}.
${feedback ? `Applicant Special Note: "${feedback}"\n` : ''}
Return JSON: {"subject": "${threadSubject}", "body": "..."}`;

    const groqKey = config.groqApiKey?.trim() || process.env.GROQ_API_KEY?.trim() || DEFAULT_GROQ_KEY;
    let generatedData: { subject: string; body: string } | null = null;

    if (groqKey && groqKey.length > 10) {
      const groqModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'];
      for (const model of groqModels) {
        try {
          await acquireGroqSlot();
          const groqRes = await fetchWithTimeout(
            'https://api.groq.com/openai/v1/chat/completions',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${groqKey}`,
              },
              body: JSON.stringify({
                model,
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: userPrompt },
                ],
                response_format: { type: 'json_object' },
                temperature: 0.7,
                max_completion_tokens: 500,
              }),
            },
            12000
          );

          if (groqRes.ok) {
            const data = await groqRes.json();
            const text = data.choices?.[0]?.message?.content || '';
            generatedData = parseEmailJson(text);
            if (generatedData) break;
          }
        } catch (e) {
          console.warn(`[FollowUp Generator] Groq ${model} failed, trying next...`);
        }
      }
    }

    if (!generatedData) {
      // High-quality deterministic fallback template
      const firstName = hrContact.name ? hrContact.name.trim().split(/\s+/)[0] : 'Team';
      const fallbackGreeting = `Hi ${firstName},`;
      const fallbackBody = isSecondFollowUp
        ? `${fallbackGreeting}\n\nI wanted to send a final quick note regarding ${candidateRole} opportunities at ${hrContact.company}. I'd love to contribute my experience in ${skillsStr} to your team. If there's an opening or a better person to connect with, please let me know.\n\n${signatureTemplate}`
        : `${fallbackGreeting}\n\nI hope you're having a productive week. Following up on my earlier note regarding ${candidateRole} roles at ${hrContact.company}—I'd welcome the opportunity to connect for a quick 5-minute chat${config.candidateCtaLink ? ` (${config.candidateCtaLink})` : ''} if you have openings.\n\n${signatureTemplate}`;

      generatedData = {
        subject: threadSubject,
        body: fallbackBody,
      };
    }

    // Clean any prior un-sent pending follow-up draft for this contact & step
    await db.hrFollowUp.deleteMany({
      where: {
        contactId: hrContactId,
        step: Number(step),
        status: 'pending',
      },
    });

    // Save generated follow-up draft
    const followUpRecord = await db.hrFollowUp.create({
      data: {
        contactId: hrContactId,
        step: Number(step),
        status: 'pending',
        subject: generatedData.subject,
        body: generatedData.body,
        scheduledFor: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      followUp: followUpRecord,
      subject: generatedData.subject,
      body: generatedData.body,
    });
  } catch (error: any) {
    console.error('Failed to generate follow-up:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate follow-up' }, { status: 500 });
  }
}
