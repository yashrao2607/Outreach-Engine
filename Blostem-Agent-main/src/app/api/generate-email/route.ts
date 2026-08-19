import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getUserId } from '@/lib/session';
import { rateLimit } from '@/lib/rate-limit';
import { getCompanySignals } from '@/lib/company-scraper';

export const maxDuration = 60;

// Default fallback Groq API key configured by user
const DEFAULT_GROQ_KEY = process.env.GROQ_API_KEY || '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';

// In-memory rate limiting queue for Groq (Max 29 requests per 60 seconds)
const GROQ_MAX_REQ_PER_MIN = 29;
const GROQ_WINDOW_MS = 60 * 1000;
const groqRequestTimestamps: number[] = [];

async function acquireGroqSlot(): Promise<void> {
  while (true) {
    const now = Date.now();
    // Purge timestamps older than 60s
    while (groqRequestTimestamps.length > 0 && groqRequestTimestamps[0] <= now - GROQ_WINDOW_MS) {
      groqRequestTimestamps.shift();
    }

    if (groqRequestTimestamps.length < GROQ_MAX_REQ_PER_MIN) {
      groqRequestTimestamps.push(now);
      return;
    }

    // Wait until the oldest request slot expires
    const oldestTimestamp = groqRequestTimestamps[0];
    const waitTime = Math.max(100, oldestTimestamp + GROQ_WINDOW_MS - now + 50);
    console.log(`[Groq RateLimiter] Rate limit queue: 29 req/min reached. Throttling for ${waitTime}ms...`);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }
}

async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

function cleanPlaceholders(text: string, name: string, company: string, title: string): string {
  return text
    .replace(/\[HR Name\]/gi, name)
    .replace(/\[Name\]/gi, name)
    .replace(/\[Hiring Manager['']?s? Name\]/gi, name)
    .replace(/\[Company Name\]/gi, company)
    .replace(/\[Company\]/gi, company)
    .replace(/\[Title\]/gi, title)
    .replace(/\[Role\]/gi, title)
    .replace(/\[Your Name\]/gi, '')
    .replace(/\[Sender Name\]/gi, '');
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
  let hrContactId: string | undefined;
  let userId: string | null = null;
  try {
    const ip = (request.headers.get('x-forwarded-for') || '127.0.0.1').split(',')[0].trim();
    if (!rateLimit(ip, 35, 60 * 1000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    hrContactId = body.hrContactId;
    const feedback = body.feedback;
    const currentSubject = body.currentSubject;
    const currentBody = body.currentBody;

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
      return NextResponse.json(
        { error: 'Profile config not found. Please configure your profile first.' },
        { status: 400 }
      );
    }

    await db.hrContact.update({
      where: { id: hrContactId, userId },
      data: { status: 'generating' },
    });

    function parseListField(raw: string): string[] {
      if (!raw || !raw.trim()) return [];
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter((s: unknown) => typeof s === 'string' && s.trim());
      } catch {}
      return raw
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
    }

    const skills = parseListField(config.candidateSkills);
    const highlights = parseListField(config.candidateHighlights);

    const skillsStr = skills.length > 0 ? skills.join(', ') : config.candidateSkills.trim() || 'Software Development, Problem Solving';
    const highlightsStr =
      highlights.length > 0
        ? highlights.map((h, i) => `${i + 1}. ${h}`).join('\n')
        : config.candidateHighlights.trim() || 'Strong technical foundation with hands-on project experience';

    const candidateRole = config.candidateDegree || 'Software Engineer';
    const candidateCollege = config.candidateCollege || '';

    // Signature formatting
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
      signatureLines.push(`Portfolio / GitHub: ${config.companyWebsite}`);
    }
    if (config.candidatePhone) {
      signatureLines.push(`Phone: ${config.candidatePhone}`);
    }
    const signatureTemplate = signatureLines.join('\n');

    const recFirstName = hrContact.name ? hrContact.name.trim().split(/\s+/)[0] : 'Team';

    // -------------------------------------------------------------
    // JOB APPLICATION PROMPT SYSTEM (100% Recruiter & HR Oriented)
    // -------------------------------------------------------------
    let systemPrompt = `You are a cold email specialist helping a candidate write a high-converting, executive-grade cold email to an HR leader, Talent Acquisition specialist, or Hiring Manager for JOB / INTERNSHIP opportunities.

STRICT RULES:
1. PURPOSE: Cold job application / career inquiry. This is strictly a job seeker reaching out for open positions, internships, or engineering/product roles at the company. NEVER write a B2B sales pitch, vendor proposal, client demo, or business partnership email.
2. TONE: Confident, crisp, ambitious, and natural (sounds like a high-caliber professional, not an AI template).
3. FORMATTING: Plain text only. NO markdown, NO asterisks, NO bullet points, NO bold text.
4. STRUCTURE:
   - Greeting: "Hi ${recFirstName}," or "Hello ${recFirstName},"
   - Opening Hook (1 sentence): Mention interest in ${hrContact.company} and state interest in ${candidateRole} opportunities on their team.
   - Background & Skills (1-2 sentences): Highlight background (${candidateRole}${candidateCollege ? ` from ${candidateCollege}` : ''}), core strengths (${skillsStr}), and key projects.
   - Resume / Portfolio (1 sentence): If resume is provided ("${config.candidateDocLink || ''}"), mention cleanly: "I've linked my resume here: ${config.candidateDocLink}".
   - Call-to-Action (1 sentence): Ask for a brief 5-minute introductory conversation. If a booking link is available: "${config.candidateCtaLink || ''}".
   - Signature: MUST be exactly:
${signatureTemplate}
5. SUBJECT LINE RULES:
   - Must be 3 to 6 words maximum.
   - Must look clean, professional, and personal so recruiters immediately open it.
   - NEVER repeat redundant words (e.g. NEVER write "${candidateRole} Application — ${config.candidateName} (${skills[0] || ''})" if the skill and role overlap).
   - Preferred patterns:
     * "${candidateRole} — ${config.candidateName}"
     * "${config.candidateName} <> ${hrContact.company} (${candidateRole})"
     * "${candidateRole} Application: ${config.candidateName}"
     * "Exploring ${candidateRole} roles at ${hrContact.company} — ${config.candidateName}"
6. LENGTH: 60–95 words total. Keep it brief, high-signal, and easy to skim on mobile.
7. OUTPUT: Return ONLY a valid JSON object: {"subject": "...", "body": "..."}`;

    let userPrompt = '';
    const draftSubject = currentSubject || hrContact.subject;
    const draftBody = currentBody || hrContact.body;

    // A/B Testing Variant Assignment (A = Direct/Technical, B = Conversational/Role-Inquiry)
    let variant = hrContact.abVariant;
    if (!variant || (variant !== 'A' && variant !== 'B')) {
      const contactIndex = await db.hrContact.count({ where: { userId, createdAt: { lte: hrContact.createdAt } } });
      variant = contactIndex % 2 === 0 ? 'A' : 'B';
    }

    const variantGuidelines = variant === 'A'
      ? `A/B TESTING VARIANT A (Direct & Professional):
- Subject Line: Clean and direct. Examples:
  * "${candidateRole} — ${config.candidateName}"
  * "${config.candidateName} <> ${hrContact.company} (${candidateRole})"
  * "${candidateRole} Application: ${config.candidateName}"
- Body Tone: Direct, outcome-oriented, highlighting core technical skills in ${skillsStr}.`
      : `A/B TESTING VARIANT B (Conversational & Engaging Hook):
- Subject Line: Conversational and curiosity-driven. Examples:
  * "Question regarding ${hrContact.company} ${candidateRole} openings — ${config.candidateName}"
  * "${config.candidateName} — exploring ${candidateRole} roles at ${hrContact.company}"
  * "Quick note for ${hrContact.company} team — ${config.candidateName}"
- Body Tone: Natural, warm, showing genuine interest in ${hrContact.company}'s work.`;

    if (feedback && draftSubject && draftBody) {
      userPrompt = `Refine the job application email draft based on this feedback from the applicant: "${feedback}"

ORIGINAL DRAFT:
Subject: ${draftSubject}
Body:
${draftBody}

APPLICANT INFO:
- Name: ${config.candidateName}
- Target Role: ${candidateRole}
- College/Background: ${candidateCollege}
- Key Skills: ${skillsStr}
- Resume Link: ${config.candidateDocLink || 'Not provided'}

RECIPIENT (HR / RECRUITER):
- Name: ${hrContact.name}
- Title: ${hrContact.title}
- Company: ${hrContact.company}

Return ONLY a JSON object: {"subject": "...", "body": "..."}`;
    } else if (hrContact.status === 'replied' && hrContact.replyBody) {
      systemPrompt = `You are helping a job applicant write a prompt, professional follow-up response to an HR recruiter or hiring manager who replied to their application email.
Tone: Polite, eager, responsive, and professional.
Length: Under 80 words.
Signature MUST be:
${signatureTemplate}
Return ONLY a valid JSON object: {"subject": "...", "body": "..."}`;

      userPrompt = `The HR recruiter (${hrContact.name} at ${hrContact.company}) replied:
"${hrContact.replyBody}"

Write a courteous reply answering their message, confirming availability for an interview or screen${config.candidateCtaLink ? ` (${config.candidateCtaLink})` : ''}, and thanking them for their time.
Return ONLY a JSON object: {"subject": "...", "body": "..."}`;
    } else {
      const companySignals = await getCompanySignals(hrContact.company);

      userPrompt = `Write an authentic, highly engaging, personalized cold job application email to ${hrContact.name || 'Hiring Team'} (${hrContact.title || 'HR / Talent Acquisition'}) at ${hrContact.company}.

APPLICANT DETAILS:
- Candidate Name: ${config.candidateName}
- Target Role: ${candidateRole}
- College / Education: ${candidateCollege}
- Skills & Tech Stack: ${skillsStr}
- Key Achievements / Projects:
${highlightsStr}
- Resume Link: ${config.candidateDocLink || ''}
- Quick Call / Calendly Link: ${config.candidateCtaLink || ''}
- Portfolio / GitHub: ${config.companyWebsite || ''}
${feedback ? `Special Applicant Directives: "${feedback}"\n` : ''}
${config.customInstructions ? `Custom Preferences: "${config.customInstructions}"\n` : ''}

TARGET COMPANY INTELLIGENCE & SIGNALS:
- Company Name: ${hrContact.company}
- Relevant Tech Stack: ${companySignals.techStack.join(', ')}
- Engineering Focus: ${companySignals.keySignal}
* Instructions: Ensure the opening hook is fresh, natural, and NOT generic. Align the candidate's skills with ${hrContact.company}'s tech stack (${companySignals.techStack.slice(0, 3).join(', ')}).

${variantGuidelines}

Return ONLY a valid JSON object: {"subject": "...", "body": "..."}`;
    }

    // --- AI Engine Execution (Groq Llama-3.3-70B prioritized, with Gemini & Local fallbacks) ---
    const groqKey = config.groqApiKey?.trim() || process.env.GROQ_API_KEY?.trim() || DEFAULT_GROQ_KEY;
    const geminiKey = config.geminiApiKey?.trim() || process.env.GEMINI_API_KEY?.trim() || '';

    // 1. Try Groq (Ultra-Fast Llama 3.3 70B & 8B with rate limiter)
    if (groqKey && groqKey.length > 10) {
      const groqModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'];
      for (const model of groqModels) {
        try {
          await acquireGroqSlot();

          console.log(`[AI Engine] Generating job application email via Groq (${model})...`);
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
                temperature: 0.8,
                max_completion_tokens: 1024,
              }),
            },
            15000
          );

          if (groqRes.ok) {
            const data = await groqRes.json();
            const responseText = data.choices?.[0]?.message?.content || '';
            const emailData = parseEmailJson(responseText);

            if (emailData) {
              const recName = hrContact.name || 'Hiring Manager';
              const recCompany = hrContact.company || 'your team';
              const recTitle = hrContact.title || 'Hiring Professional';
              const cleanedSubject = cleanPlaceholders(emailData.subject, recName, recCompany, recTitle);
              const cleanedBody = cleanPlaceholders(emailData.body, recName, recCompany, recTitle);

              await db.hrContact.update({
                where: { id: hrContactId, userId },
                data: {
                  status: 'generated',
                  subject: cleanedSubject,
                  body: cleanedBody,
                  abVariant: variant,
                },
              });

              console.log(`[AI Engine] Job application email generated successfully via Groq (${model}) for ${recName} @ ${recCompany} (Variant ${variant})`);
              return NextResponse.json({
                success: true,
                provider: 'groq',
                model,
                variant,
                email: { subject: cleanedSubject, body: cleanedBody },
              });
            }
          } else {
            const errText = await groqRes.text();
            console.warn(`[AI Engine] Groq API (${model}) returned status ${groqRes.status}: ${errText}`);
          }
        } catch (groqErr: any) {
          console.warn(`[AI Engine] Groq generation error (${model}):`, groqErr.message);
        }
      }
    }

    // 2. Fallback to Gemini if configured
    if (geminiKey && geminiKey.length > 5) {
      try {
        console.log('[AI Engine] Fallback: Generating job application email via Gemini...');
        const geminiRes = await fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
              generationConfig: { responseMimeType: 'application/json' },
            }),
          },
          15000
        );

        if (geminiRes.ok) {
          const data = await geminiRes.json();
          const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
          const emailData = parseEmailJson(responseText);

          if (emailData) {
            const recName = hrContact.name || 'Hiring Manager';
            const recCompany = hrContact.company || 'your team';
            const recTitle = hrContact.title || 'Hiring Professional';
            const cleanedSubject = cleanPlaceholders(emailData.subject, recName, recCompany, recTitle);
            const cleanedBody = cleanPlaceholders(emailData.body, recName, recCompany, recTitle);

            await db.hrContact.update({
              where: { id: hrContactId, userId },
              data: {
                status: 'generated',
                subject: cleanedSubject,
                body: cleanedBody,
                abVariant: variant,
              },
            });

            return NextResponse.json({
              success: true,
              provider: 'gemini',
              variant,
              email: { subject: cleanedSubject, body: cleanedBody },
            });
          }
        }
      } catch (geminiErr: any) {
        console.warn('[AI Engine] Gemini generation error:', geminiErr.message);
      }
    }

    // 3. Fallback to Local Smart Job Application Copywriter
    console.log('[AI Engine] Using Local Job Application Copywriter fallback...');
    const isReply = hrContact.status === 'replied' && !!hrContact.replyBody;
    const emailData = generateLocalJobEmail(config, hrContact, feedback, isReply);

    const recName = hrContact.name || 'Hiring Manager';
    const recCompany = hrContact.company || 'your team';
    const recTitle = hrContact.title || 'Hiring Professional';
    const cleanedSubject = cleanPlaceholders(emailData.subject, recName, recCompany, recTitle);
    const cleanedBody = cleanPlaceholders(emailData.body, recName, recCompany, recTitle);

    await db.hrContact.update({
      where: { id: hrContactId, userId },
      data: {
        status: 'generated',
        subject: cleanedSubject,
        body: cleanedBody,
        abVariant: variant,
      },
    });

    return NextResponse.json({
      success: true,
      provider: 'local',
      variant,
      email: { subject: cleanedSubject, body: cleanedBody },
    });
  } catch (error) {
    console.error('Failed to generate email:', error);

    try {
      if (hrContactId && userId) {
        await db.hrContact.update({
          where: { id: hrContactId, userId },
          data: {
            status: 'pending',
            error: error instanceof Error ? error.message : 'Email generation failed',
          },
        });
      }
    } catch {}

    return NextResponse.json({ error: 'Failed to generate email' }, { status: 500 });
  }
}

function generateLocalJobEmail(
  config: any,
  hrContact: any,
  feedback?: string,
  isReply: boolean = false
): { subject: string; body: string } {
  const candidateName = config.candidateName || 'Candidate';
  const targetRole = config.candidateDegree || 'Software Engineer';
  const college = config.candidateCollege || '';

  let skills: string[] = [];
  let highlights: string[] = [];
  try {
    skills = JSON.parse(config.candidateSkills);
  } catch {}
  try {
    highlights = JSON.parse(config.candidateHighlights);
  } catch {}

  const skillStr = skills.length > 0 ? skills.slice(0, 3).join(', ') : 'software engineering, problem solving';
  const highlightStr = highlights.length > 0 ? highlights[0] : 'building scalable applications and robust systems';

  const recipientName = hrContact.name === 'Team' ? 'Team' : hrContact.name;
  const companyName = hrContact.company || 'your team';

  const signatureLines = [
    'Best regards,',
    '',
    candidateName,
    college ? `${targetRole} | ${college}` : targetRole,
  ];
  if (config.includeLinkedin && config.candidateLinkedin) {
    signatureLines.push(`LinkedIn: ${config.candidateLinkedin}`);
  }
  if (config.includeWebsite && config.companyWebsite) {
    signatureLines.push(`Portfolio / GitHub: ${config.companyWebsite}`);
  }
  if (config.candidatePhone) {
    signatureLines.push(`Phone: ${config.candidatePhone}`);
  }
  const signatureTemplate = signatureLines.join('\n');

  if (isReply && hrContact.replyBody) {
    const subject = hrContact.replySubject
      ? hrContact.replySubject.startsWith('Re:')
        ? hrContact.replySubject
        : `Re: ${hrContact.replySubject}`
      : `Re: ${targetRole} Application — ${candidateName}`;

    const body = `Hello ${recipientName},

Thank you for getting back to me. I appreciate you taking the time to respond to my note.

I would love to discuss how my background in ${skillStr} aligns with ${companyName}'s current engineering priorities.

If you are open to coordinating a quick chat, you can pick a convenient time on my calendar here: ${config.candidateCtaLink || 'calendar link'}

I have also linked my resume here for easy review: ${config.candidateDocLink || 'resume link'}

Looking forward to speaking with you.

${signatureTemplate}`;

    return { subject, body };
  }

  const firstName = recipientName ? recipientName.trim().split(/\s+/)[0] : 'Team';
  const cleanRole = targetRole.trim();

  // Check if primary skill is redundant with role name
  const primarySkill = skills[0] || '';
  const isSkillRedundant = !primarySkill || 
    cleanRole.toLowerCase().includes(primarySkill.toLowerCase()) || 
    primarySkill.toLowerCase().includes(cleanRole.toLowerCase());
  const skillSuffix = isSkillRedundant ? '' : ` (${primarySkill})`;

  // High-Converting, Clean Subject Line Library (A/B Balanced)
  const isVariantB = hrContact.abVariant === 'B';
  const variantASubjects = [
    `${cleanRole} — ${candidateName}${skillSuffix}`,
    `${candidateName} <> ${companyName} (${cleanRole})`,
    `${cleanRole} Application — ${candidateName}`,
    `${cleanRole} role at ${companyName} — ${candidateName}`,
    `Application: ${candidateName} — ${cleanRole}`,
  ];
  const variantBSubjects = [
    `Question regarding ${companyName} ${cleanRole} openings — ${candidateName}`,
    `${candidateName} — exploring ${cleanRole} roles at ${companyName}`,
    `Quick note for ${companyName} team — ${candidateName}`,
    `Intro: ${candidateName} (${cleanRole})`,
    `Exploring ${cleanRole} opportunities at ${companyName} | ${candidateName}`,
  ];

  const candidateSubjects = isVariantB ? variantBSubjects : variantASubjects;
  const hash = Math.abs((recipientName + companyName).split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0));
  const subject = candidateSubjects[hash % candidateSubjects.length];

  // 4 Distinct High-Converting Body Architectures
  const templateStyle = hash % 4;
  let body = '';

  if (templateStyle === 0) {
    // Style 1: Problem-Solver & Project Focus
    body = `Hi ${firstName},

I've been following ${companyName}'s work and wanted to reach out regarding open ${cleanRole} roles on your team.

As a ${cleanRole} with strong hands-on experience in ${skillStr}${college ? ` (${college})` : ''}, I recently worked on ${highlightStr}. I would love to bring this experience to ${companyName} to build impactful features.

You can review my background and resume here: ${config.candidateDocLink || config.companyWebsite || 'resume link'}

Would you have 5 minutes for a brief introductory conversation, or could you point me to the right hiring manager on your team?

${signatureTemplate}`;
  } else if (templateStyle === 1) {
    // Style 2: Tech-Stack Alignment & Fast Contributor
    body = `Hi ${firstName},

I am writing to express my interest in joining ${companyName} as a ${cleanRole}.

My background centers on ${skillStr}. In my recent work, I focused on ${highlightStr}, and I am eager to contribute directly to ${companyName}'s roadmap.

I've linked my resume here for your review: ${config.candidateDocLink || 'resume link'}

If your team is currently hiring or planning upcoming headcount, I would welcome the opportunity for a quick chat${config.candidateCtaLink ? ` (${config.candidateCtaLink})` : ''}.

${signatureTemplate}`;
  } else if (templateStyle === 2) {
    // Style 3: Impact & Curiosity Inquiry
    body = `Hi ${firstName},

I've been admiring the product and technical work at ${companyName} and wanted to explore potential ${cleanRole} opportunities on your team.

Bringing solid experience in ${skillStr}${college ? ` from ${college}` : ''}, I've delivered impactful work including ${highlightStr}. I am confident I can add immediate value to your sprints.

My resume is available here: ${config.candidateDocLink || config.companyWebsite || 'resume link'}

Would you be open to a quick 5-minute introductory call this week?

${signatureTemplate}`;
  } else {
    // Style 4: Direct Professional Pitch
    body = `Hi ${firstName},

Reaching out to explore potential ${cleanRole} openings at ${companyName}.

I specialize in ${skillStr} with a track record in ${highlightStr}. I am looking for a high-impact team where I can solve challenging problems and deliver high-quality work.

Feel free to look through my resume here: ${config.candidateDocLink || config.companyWebsite || 'resume link'}

Could you let me know if you are open to a brief conversation, or if there is another team member I should connect with?

${signatureTemplate}`;
  }

  if (feedback) {
    body = `[Refined based on feedback: "${feedback}"]\n\n` + body;
  }

  return { subject, body };
}
