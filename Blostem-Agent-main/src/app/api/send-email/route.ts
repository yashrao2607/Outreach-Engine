import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getEmailTrackingBaseUrl } from '@/lib/tracking-url';
import { isSuppressed, suppressEmail } from '@/lib/unsubscribe';
import { renderTemplate, type MergeValues } from '@/lib/spintax';
import { rateLimit } from '@/lib/rate-limit';

import { getUserId } from '@/lib/session';

export const maxDuration = 60;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Convert the (already rendered) plain body to HTML. Links are rewritten through
 * the tracking redirect ONLY when a deliverability-safe branded tracking URL is
 * available AND tracking is enabled; otherwise the real links are preserved so
 * nothing breaks and no random tunnel domain ever enters the email.
 */
function convertBodyToHtml(
  body: string,
  hrContactId: string,
  trackingBase: string | null,
  candidateCtaLink: string,
  candidateDocLink: string
): string {
  let html = escapeHtml(body);

  const urlRegex = /https?:\/\/[^\s<]+/g;
  const normalizeUrl = (urlStr: string): string => {
    if (!urlStr) return '';
    let u = urlStr.trim().toLowerCase();
    u = u.replace(/^(https?:\/\/)?(www\.)?/, '');
    const qIdx = u.indexOf('?');
    if (qIdx !== -1) u = u.substring(0, qIdx);
    const hIdx = u.indexOf('#');
    if (hIdx !== -1) u = u.substring(0, hIdx);
    return u.replace(/\/+$/, '');
  };

  const normCta = candidateCtaLink ? normalizeUrl(candidateCtaLink) : '';
  const normDoc = candidateDocLink ? normalizeUrl(candidateDocLink) : '';

  html = html.replace(urlRegex, (url) => {
    let cleanUrl = url;
    let suffix = '';
    const match = url.match(/["'`;).,\]}>!?]+$/);
    if (match) {
      cleanUrl = url.substring(0, url.length - match[0].length);
      suffix = match[0];
    }

    // No safe tracking base -> keep the real link (deliverability-safe default).
    if (!trackingBase) {
      return `<a href="${cleanUrl}" style="color:#2563eb;text-decoration:underline;">${cleanUrl}</a>${suffix}`;
    }

    // Un-escape HTML entities so the tracking redirect URL is correct (cleanUrl
    // was extracted from escapeHtml(body) so & → &amp; etc.)
    const rawUrl = cleanUrl.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

    const normClean = normalizeUrl(rawUrl);
    let type = 'general';
    if (normCta && (normClean.includes(normCta) || normCta.includes(normClean))) {
      type = 'cta';
    } else if (normDoc && (normClean.includes(normDoc) || normDoc.includes(normClean))) {
      type = 'doc';
    } else {
      const lowerUrl = rawUrl.toLowerCase();
      if (
        lowerUrl.includes('calendly.com') || lowerUrl.includes('cal.com') ||
        lowerUrl.includes('/schedule') || lowerUrl.includes('/booking') || lowerUrl.includes('/meet') ||
        lowerUrl.includes('linkedin.com') || lowerUrl.includes('github.com') || lowerUrl.includes('portfolio') ||
        lowerUrl.includes('vercel.app')
      ) {
        type = 'cta';
      } else if (
        /\.(docx?|pptx|pdf)([?#]|$)/i.test(lowerUrl) ||
        lowerUrl.includes('docs.google.com') || lowerUrl.includes('drive.google.com') ||
        lowerUrl.includes('dropbox.com') || lowerUrl.includes('docsend.com') || lowerUrl.includes('pitch.com') ||
        lowerUrl.includes('resume') || lowerUrl.includes('cv')
      ) {
        type = 'doc';
      }
    }

    const trackingUrl = `${trackingBase}/api/track/click?id=${hrContactId}&type=${type}&url=${encodeURIComponent(rawUrl)}`;
    return `<a href="${trackingUrl}" style="color:#2563eb;text-decoration:underline;">${cleanUrl}</a>${suffix}`;
  });

  return html.replace(/\n/g, '<br />');
}


export async function POST(request: Request) {
  try {
    const ip = (request.headers.get('x-forwarded-for') || '127.0.0.1').split(',')[0].trim();
    if (!rateLimit(ip, 15, 60 * 1000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bodyJson = await request.json();
    const hrContactId = bodyJson.hrContactId;
    const subject = bodyJson.subject;
    const body = bodyJson.body;
    const isTest = Boolean(bodyJson.isTest);
    const isFollowUp = Boolean(bodyJson.isFollowUp);
    const followUpStep = Number(bodyJson.followUpStep || 1);

    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    const requestUrl = host ? `${proto}://${host}` : null;

    if (!hrContactId || !subject || !body) {
      return NextResponse.json(
        { error: 'hrContactId, subject, and body are required' },
        { status: 400 }
      );
    }

    const hrContact = await db.hrContact.findFirst({
      where: { id: hrContactId, userId }
    });
    if (!hrContact) {
      return NextResponse.json({ error: 'HR contact not found' }, { status: 404 });
    }

    const config = await db.appConfig.findUnique({
      where: { userId },
      include: { user: true }
    });
    if (!config || !config.emailUser || !config.emailPass) {
      return NextResponse.json(
        { error: 'Email credentials not configured. Please set up your Gmail credentials in settings.' },
        { status: 400 }
      );
    }

    // --- Compliance & safety gates (skipped for test-to-self) ---
    if (!isTest) {
      if (hrContact.unsubscribed || hrContact.bounced || (await isSuppressed(userId, hrContact.email))) {
        // Ensure both the contact flag and the suppression list are in sync
        if (!hrContact.unsubscribed) {
          await db.hrContact.update({
            where: { id: hrContactId },
            data: { unsubscribed: true, unsubscribedAt: new Date(), status: 'failed', error: 'Suppressed (opted out / bounced)' },
          });
        }
        // Always ensure a suppression row exists so future sends are blocked
        await suppressEmail(userId, hrContact.email, hrContact.bounced ? 'bounce' : 'unsubscribe', hrContactId);
        return NextResponse.json(
          { error: 'Recipient is on the do-not-contact list (unsubscribed or bounced).' },
          { status: 409 }
        );
      }

      // Gmail-safe daily cap (rolling 24h)
      const cap = config.dailySendLimit ?? 40;
      if (cap > 0) {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const sentInWindow = await db.hrContact.count({ where: { userId, sentAt: { gte: since } } });
        if (sentInWindow >= cap) {
          return NextResponse.json(
            { error: `Daily sending limit reached (${cap}/24h). Pausing to protect deliverability. Adjust the limit in Settings.` },
            { status: 429 }
          );
        }
      }
    }

    // --- Render spintax + merge tags ---
    const firstName = (hrContact.name || '').trim().split(/\s+/)[0] || '';
    const mergeValues: MergeValues = {
      name: hrContact.name,
      firstName,
      lastName: (hrContact.name || '').trim().split(/\s+/).slice(1).join(' '),
      company: hrContact.company,
      title: hrContact.title,
      email: hrContact.email,
      senderName: config.candidateName,
      senderCompany: config.candidateCollege,
    };
    const renderedSubject = renderTemplate(subject, mergeValues);
    const renderedBody = renderTemplate(body, mergeValues);

    // --- Tracking (only branded, deliverability-safe URLs; gated by setting) ---
    const trackingBase = config.enableTracking ? await getEmailTrackingBaseUrl(userId, requestUrl) : null;

    // Plain-text body
    const text = renderedBody;
    let html: string | undefined;

    if (!isTest && trackingBase) {
      const bodyHtml = convertBodyToHtml(renderedBody, hrContactId, trackingBase, config.candidateCtaLink, config.candidateDocLink);
      const pixelHtml = `<img src="${trackingBase}/api/track/open?id=${hrContactId}" alt="" width="1" height="1" border="0" style="width:1px!important;height:1px!important;min-width:1px!important;min-height:1px!important;border:0!important;outline:none!important;display:inline!important;margin:0!important;padding:0!important;opacity:0.01!important;" />`;
      html = `<div dir="ltr" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2937;line-height:1.6;margin:0;padding:0;">
${bodyHtml}${pixelHtml}
</div>`;
    } else {
      const bodyHtml = convertBodyToHtml(renderedBody, hrContactId, null, config.candidateCtaLink, config.candidateDocLink);
      html = `<div dir="ltr" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2937;line-height:1.6;margin:0;padding:0;">
${bodyHtml}
</div>`;
    }
    
    if (html) {
      console.log('[SendEmail] HTML email generated. IsTest:', isTest, 'IsFollowUp:', isFollowUp, 'HasTrackingPixel:', !isTest && Boolean(trackingBase));
    }

    // --- Transporter Compose ---
    const domain = config.emailUser.toLowerCase().split('@')[1] || '';
    let transporter;
    if (domain.includes('outlook.com') || domain.includes('hotmail.com') || domain.includes('live.com') || domain.includes('office365.com')) {
      transporter = nodemailer.createTransport({
        host: 'smtp.office365.com',
        port: 587,
        secure: false,
        auth: { user: config.emailUser, pass: config.emailPass },
      });
    } else if (domain.includes('yahoo.com')) {
      transporter = nodemailer.createTransport({
        host: 'smtp.mail.yahoo.com',
        port: 465,
        secure: true,
        auth: { user: config.emailUser, pass: config.emailPass },
      });
    } else {
      transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user: config.emailUser, pass: config.emailPass },
      });
    }

    const recipient = isTest ? (config.candidateEmail || config.emailUser) : hrContact.email;
    const finalSubject = isTest ? `[TEST] ${renderedSubject}` : renderedSubject;

    const headers: Record<string, string> = {};

    const replyTo =
      config.replyToEmail && config.replyToEmail.includes('@') ? config.replyToEmail.trim() : undefined;

    const senderDisplayName = config.candidateName?.trim() || (config as any).user?.name?.trim() || '';
    
    // Threading headers for follow-ups (In-Reply-To & References)
    let inReplyTo: string | undefined = undefined;
    let references: string[] | undefined = undefined;

    if (isFollowUp && hrContact.messageId) {
      const cleanOrigId = hrContact.messageId.trim();
      const origMsgId = cleanOrigId.startsWith('<') && cleanOrigId.endsWith('>') ? cleanOrigId : `<${cleanOrigId}>`;
      inReplyTo = origMsgId;

      const priorFollowUps = await db.hrFollowUp.findMany({
        where: { contactId: hrContactId, status: 'sent', messageId: { not: null } },
        select: { messageId: true },
      });

      const allRefs = [origMsgId];
      for (const p of priorFollowUps) {
        if (p.messageId) {
          const pClean = p.messageId.trim();
          allRefs.push(pClean.startsWith('<') && pClean.endsWith('>') ? pClean : `<${pClean}>`);
        }
      }
      references = allRefs;
    }

    const mailOptions: nodemailer.SendMailOptions = {
      from: senderDisplayName ? `"${senderDisplayName}" <${config.emailUser}>` : config.emailUser,
      to: recipient,
      replyTo,
      subject: finalSubject,
      text,
      ...(html ? { html } : {}),
      headers,
      inReplyTo,
      references,
      attachments: [],
      priority: 'normal',
      xMailer: false,
    };

    try {
      const info = await transporter.sendMail(mailOptions);

      if (!isTest) {
        if (isFollowUp) {
          // Calculate next follow-up due date
          const maxSteps = config.maxFollowUpSteps ?? 2;
          const nextDue = followUpStep < maxSteps && config.enableFollowUps !== false
            ? new Date(Date.now() + (config.followUp2DelayDays ?? 4) * 24 * 60 * 60 * 1000)
            : null;

          // Check for existing pending follow-up draft to update
          const existingDraft = await db.hrFollowUp.findFirst({
            where: { contactId: hrContactId, step: followUpStep, status: 'pending' },
            orderBy: { createdAt: 'desc' },
          });

          if (existingDraft) {
            await db.hrFollowUp.update({
              where: { id: existingDraft.id },
              data: {
                status: 'sent',
                subject: renderedSubject,
                body: renderedBody,
                messageId: info.messageId,
                sentAt: new Date(),
              },
            });
          } else {
            await db.hrFollowUp.create({
              data: {
                contactId: hrContactId,
                step: followUpStep,
                status: 'sent',
                subject: renderedSubject,
                body: renderedBody,
                messageId: info.messageId,
                sentAt: new Date(),
              },
            });
          }

          await db.hrContact.update({
            where: { id: hrContactId, userId },
            data: {
              followUpStep: followUpStep,
              followUpStatus: 'sent',
              lastFollowUpAt: new Date(),
              nextFollowUpDue: nextDue,
              error: null,
            },
          });
        } else {
          // Initial cold application dispatch
          const nextDue = config.enableFollowUps !== false
            ? new Date(Date.now() + (config.followUp1DelayDays ?? 3) * 24 * 60 * 60 * 1000)
            : null;

          await db.hrContact.update({
            where: { id: hrContactId, userId },
            data: {
              status: 'sent',
              subject: renderedSubject,
              body: renderedBody,
              sentAt: new Date(),
              messageId: info.messageId,
              followUpStep: 0,
              followUpStatus: 'idle',
              nextFollowUpDue: nextDue,
              error: null,
            },
          });
        }
      }

      return NextResponse.json({ success: true, messageId: info.messageId, isFollowUp });
    } catch (sendError: unknown) {
      const errorMessage = sendError instanceof Error ? sendError.message : 'Failed to send email';

      console.error(`[SendEmail Error] Failed to deliver email to ${hrContact.email}: ${errorMessage}`);

      // Auto-suppress and move to Unsubscribed / Bounced list upon ANY sending/delivery failure
      if (!isTest && hrContactId && userId) {
        try {
          await db.hrContact.update({
            where: { id: hrContactId, userId },
            data: {
              status: 'failed',
              subject: renderedSubject,
              body: renderedBody,
              error: errorMessage,
              bounced: true,
              bouncedAt: new Date(),
              unsubscribed: true,
              unsubscribedAt: new Date(),
            },
          });
          await suppressEmail(userId, hrContact.email, 'bounce', hrContactId);
          console.log(`[Suppression] Contact ${hrContact.email} automatically added to Unsubscribed / Suppression list.`);
        } catch (dbErr) {
          console.error('[SendEmail] Failed to update suppression status:', dbErr);
        }
      }

      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  } catch (error) {
    console.error('Failed to send email:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
