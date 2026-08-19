import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { ImapFlow } from 'imapflow';
import { getUserId } from '@/lib/session';
import { suppressEmail } from '@/lib/unsubscribe';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

function decodeQuotedPrintable(str: string): string {
  return str
    .replace(/=\r?\n/g, '') // remove soft line breaks
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function cleanEmailBody(text: string): string {
  const decoded = decodeQuotedPrintable(text);
  const lines = decoded.split(/\r?\n/);
  const cleanedLines: string[] = [];
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase().trim();
    // Stop at original email thread markers, quotes, or standard signature cuts
    if (
      line.trim().startsWith('>') || 
      (lowerLine.startsWith('on ') && lowerLine.includes('wrote:')) ||
      lowerLine.startsWith('from:') ||
      lowerLine.startsWith('to:') ||
      lowerLine.startsWith('-----original message-----') ||
      lowerLine.startsWith('sent from my') // mobile signatures
    ) {
      break;
    }
    cleanedLines.push(line);
  }
  
  const result = cleanedLines.join('\n').trim();
  return result || decoded.trim() || text.trim();
}

function parseRawEmail(rawSource: string): { subject: string; body: string } {
  // Find double newline separating headers and body
  const match = rawSource.match(/\r?\n\r?\n/);
  if (!match || match.index === undefined) {
    return { subject: 'No Subject', body: cleanEmailBody(rawSource) };
  }
  const firstDoubleNewline = match.index;
  const headersPart = rawSource.substring(0, firstDoubleNewline);
  let bodyPart = rawSource.substring(firstDoubleNewline + match[0].length);

  // Extract Subject header
  const subjectMatch = headersPart.match(/^Subject:\s*(.*)$/im);
  let subject = subjectMatch ? subjectMatch[1].trim() : 'No Subject';

  // Decode Subject if it is MIME encoded (e.g. =?UTF-8?B?...)
  if (subject.startsWith('=?')) {
    subject = subject.replace(/=\?utf-8\?[B|Q]\?(.*?)\?=/gi, (m, content) => {
      if (m.toLowerCase().includes('?b?')) {
        return Buffer.from(content, 'base64').toString('utf8');
      } else {
        return decodeQuotedPrintable(content);
      }
    });
  }

  // Handle transfer encoding
  const encodingMatch = headersPart.match(/Content-Transfer-Encoding:\s*(\S+)/i);
  const encoding = encodingMatch ? encodingMatch[1].trim().toLowerCase() : '';

  if (encoding === 'base64') {
    bodyPart = Buffer.from(bodyPart.replace(/\s+/g, ''), 'base64').toString('utf8');
  } else if (encoding === 'quoted-printable') {
    bodyPart = decodeQuotedPrintable(bodyPart);
  }

  // If email is multipart, extract the first plain text chunk
  const contentTypeMatch = headersPart.match(/Content-Type:\s*multipart\/[a-z]+/i);
  if (contentTypeMatch) {
    const boundaryMatch = headersPart.match(/boundary="?([^";\n]+)"?/i);
    if (boundaryMatch) {
      const boundary = boundaryMatch[1];
      const chunks = bodyPart.split(`--${boundary}`);
      
      for (const chunk of chunks) {
        if (chunk.toLowerCase().includes('content-type: text/plain')) {
          const chunkParts = chunk.split(/\r?\n\r?\n/);
          let text = chunkParts.slice(1).join('\n').trim();
          
          // Check if chunk has its own encoding
          const chunkEncodingMatch = chunk.match(/Content-Transfer-Encoding:\s*(\S+)/i);
          const chunkEncoding = chunkEncodingMatch ? chunkEncodingMatch[1].trim().toLowerCase() : '';
          if (chunkEncoding === 'base64') {
            text = Buffer.from(text.replace(/\s+/g, ''), 'base64').toString('utf8');
          } else if (chunkEncoding === 'quoted-printable') {
            text = decodeQuotedPrintable(text);
          }
          return { subject, body: cleanEmailBody(text) };
        }
      }
    }
  }

  return { subject, body: cleanEmailBody(bodyPart) };
}

const DEFAULT_GROQ_KEY = process.env.GROQ_API_KEY || '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';

async function classifyAndDraftReply(
  replyText: string,
  contact: any,
  config: any,
  groqKey: string
): Promise<{ classification: string; snippet: string; suggestedDraft: string }> {
  const firstName = contact.name ? contact.name.trim().split(/\s+/)[0] : 'there';
  const ctaLink = config.candidateCtaLink ? ` (${config.candidateCtaLink})` : '';

  const fallback = {
    classification: 'INFO_REQUESTED',
    snippet: replyText.slice(0, 120),
    suggestedDraft: `Hi ${firstName},\n\nThank you for getting back to me! I would love to connect for a quick conversation. Please let me know what day and time works best for your team, or feel free to pick a slot directly via my calendar${ctaLink}.\n\nBest regards,\n${config.candidateName || 'Candidate'}`,
  };

  const activeKey = groqKey && groqKey.length > 10 ? groqKey : DEFAULT_GROQ_KEY;

  try {
    const prompt = `Analyze this incoming reply from a recruiter/HR (${contact.name} @ ${contact.company}) to job applicant (${config.candidateName}):
"${replyText}"

Task:
1. Classify intent into EXACTLY ONE of:
- INTERVIEW_INTEREST (recruiter wants to talk, interview, schedule call, or review code)
- FORWARDED (profile was forwarded to hiring manager / engineering team)
- INFO_REQUESTED (asked for CTC, notice period, location, portfolio, resume)
- REJECTION (no current opening, not moving forward)
- OTHER (general acknowledgement, out of office)

2. Write a 1-sentence summary snippet.

3. Write an ideal, professional candidate response draft (under 60 words) from ${config.candidateName}${config.candidateCtaLink ? ` offering meeting link ${config.candidateCtaLink}` : ''}.

Return strictly valid JSON:
{
  "classification": "INTERVIEW_INTEREST",
  "snippet": "Recruiter is interested and requested availability for an introductory call.",
  "suggestedDraft": "Hi ..."
}`;

    const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'];
    for (const model of models) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${activeKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: 'You are an expert career copilot and email classification engine. Output strictly valid JSON.' },
              { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.2,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
          return {
            classification: parsed.classification || 'INFO_REQUESTED',
            snippet: parsed.snippet || replyText.slice(0, 100),
            suggestedDraft: parsed.suggestedDraft || fallback.suggestedDraft,
          };
        }
      } catch {}
    }
  } catch (e) {
    console.warn('[Check Replies] Groq classification failed, using deterministic fallback:', e);
  }

  return fallback;
}

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await db.appConfig.findUnique({ where: { userId } });
    if (!config || !config.emailUser || !config.emailPass) {
      return NextResponse.json(
        { error: 'Email credentials are not configured. Please enter them in settings.' },
        { status: 400 }
      );
    }

    // Get all HR contacts for this user
    const allContacts = await db.hrContact.findMany({
      where: { userId },
    });

    const sentContacts = allContacts.filter(c => 
      c.sentAt && (c.status === 'sent' || c.status === 'opened' || c.status === 'clicked')
    );

    if (allContacts.length === 0) {
      return NextResponse.json({
        success: true,
        checked: 0,
        replied: 0,
        bounced: 0,
        repliedList: [],
        message: 'No contacts found to audit.'
      });
    }

    const domain = config.emailUser.toLowerCase().split('@')[1] || '';
    let imapHost = 'imap.gmail.com';
    if (domain.includes('outlook.com') || domain.includes('hotmail.com') || domain.includes('live.com') || domain.includes('office365.com')) {
      imapHost = 'outlook.office365.com';
    } else if (domain.includes('yahoo.com')) {
      imapHost = 'imap.mail.yahoo.com';
    }

    const client = new ImapFlow({
      host: imapHost,
      port: 993,
      secure: true,
      auth: {
        user: config.emailUser.trim(),
        pass: config.emailPass.trim(),
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 30000,
      logger: false,
    });

    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    
    let newlyRepliedCount = 0;
    let newlyBouncedCount = 0;
    const repliedContactsList: string[] = [];
    const bouncedContactsList: string[] = [];

    // Fast map of lowercase email to contact record
    const contactByEmail = new Map<string, typeof allContacts[0]>();
    for (const c of allContacts) {
      if (c.email) contactByEmail.set(c.email.trim().toLowerCase(), c);
    }

    try {
      // 1. SCAN FOR ASYNCHRONOUS BOUNCE NOTIFICATIONS (NDR / Mail Delivery Subsystem / Postmaster)
      const bounceSearchTerms = ['mailer-daemon', 'postmaster', 'googlemail.com', 'Mail Delivery Subsystem'];
      const bounceUids = new Set<number>();

      for (const term of bounceSearchTerms) {
        try {
          const uids = await client.search({ from: term }, { uid: true });
          if (Array.isArray(uids)) {
            // Take the latest 15 bounce emails to keep scan fast
            uids.slice(-15).forEach(uid => bounceUids.add(uid));
          }
        } catch {}
      }

      for (const uid of Array.from(bounceUids)) {
        try {
          const message = await client.fetchOne(uid.toString(), {
            envelope: true,
            source: true,
          }, { uid: true });

          if (!message || !message.source) continue;

          const rawSource = message.source.toString('utf8');
          const parsed = parseRawEmail(rawSource);
          const fullContent = (parsed.subject + '\n' + parsed.body + '\n' + rawSource).toLowerCase();

          // Check for delivery failure markers
          const isBounce = fullContent.includes('message not delivered') ||
            fullContent.includes('delivery status notification') ||
            fullContent.includes('undelivered mail') ||
            fullContent.includes('couldn\'t be delivered') ||
            fullContent.includes('remote server is misconfigured') ||
            fullContent.includes('user unknown') ||
            fullContent.includes('recipient address rejected') ||
            fullContent.includes('550 5.1.1') ||
            fullContent.includes('554 5.7.1');

          if (isBounce) {
            // Extract all email addresses mentioned in the bounce message
            const extractedEmails = rawSource.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
            const uniqueExtracted = Array.from(new Set(extractedEmails.map(e => e.toLowerCase())));

            for (const extracted of uniqueExtracted) {
              const matchedContact = contactByEmail.get(extracted);
              if (matchedContact && !matchedContact.bounced && !matchedContact.unsubscribed) {
                // Mark contact as failed, bounced, and unsubscribed immediately
                await db.hrContact.update({
                  where: { id: matchedContact.id, userId },
                  data: {
                    status: 'failed',
                    bounced: true,
                    bouncedAt: new Date(),
                    unsubscribed: true,
                    unsubscribedAt: new Date(),
                    error: 'Bounced: Remote server rejected or misconfigured (NDR)',
                    followUpStatus: 'cancelled',
                    nextFollowUpDue: null,
                  },
                });

                // Cancel all pending follow-ups for this prospect
                await db.hrFollowUp.updateMany({
                  where: { contactId: matchedContact.id, status: 'pending' },
                  data: { status: 'cancelled' },
                });

                // Add to global suppression list
                await suppressEmail(userId, matchedContact.email, 'bounce', matchedContact.id);

                newlyBouncedCount++;
                bouncedContactsList.push(`${matchedContact.name || 'Prospect'} (${matchedContact.email}) - Bounced & Suppressed`);
              }
            }
          }
        } catch (e) {
          console.warn(`[Check Replies] Error inspecting bounce message UID ${uid}:`, e);
        }
      }

      // 2. SCAN FOR DIRECT REPLIES FROM SENT CONTACTS
      for (const contact of sentContacts) {
        if (!contact.sentAt || !contact.email) continue;
        if (contact.bounced || contact.unsubscribed) continue;

        const cleanEmail = contact.email.trim().toLowerCase();

        // Search by sender address with UID mode
        const searchResults = await client.search({ from: cleanEmail }, { uid: true });
        if (!searchResults || searchResults.length === 0) continue;

        // Get the latest message UID
        const latestUid = searchResults[searchResults.length - 1];
        
        const message = await client.fetchOne(latestUid.toString(), {
          envelope: true,
          source: true,
        }, { uid: true });

        if (!message) continue;

        // Check if reply date is around or after original sent date (allowing a 2-min drift window)
        const replyEnvelopeDate = message.envelope?.date;
        const replyDate = new Date(replyEnvelopeDate || message.internalDate || new Date());
        const sentDate = new Date(contact.sentAt);

        const isThreadReply = Boolean(
          (message.envelope?.inReplyTo && contact.messageId && message.envelope.inReplyTo.includes(contact.messageId.replace(/[<>]/g, ''))) ||
          (message.envelope?.subject && contact.subject && message.envelope.subject.toLowerCase().includes(contact.subject.toLowerCase().replace(/^(re:\s*)+/i, '').trim()))
        );

        const isAfterSent = replyDate.getTime() >= (sentDate.getTime() - 120_000);

        if (isThreadReply || isAfterSent) {
          const rawSource = message.source ? message.source.toString('utf8') : '';
          const parsed = parseRawEmail(rawSource);
          const safeBody = parsed.body.length > 10_000 ? parsed.body.slice(0, 10_000) + '…' : parsed.body;

          // Run AI Intent Classifier & Auto-Drafter
          const aiAnalysis = await classifyAndDraftReply(safeBody, contact, config, config.groqApiKey);

          // Update database contact record with full classification and draft
          await db.hrContact.update({
            where: { id: contact.id, userId },
            data: {
              status: 'replied',
              opened: true,
              openedAt: contact.openedAt || replyDate,
              replySubject: parsed.subject,
              replyBody: safeBody,
              repliedAt: replyDate,
              replyClassification: aiAnalysis.classification,
              replySnippet: aiAnalysis.snippet,
              suggestedDraft: aiAnalysis.suggestedDraft,
              followUpStatus: 'cancelled',
              nextFollowUpDue: null,
            },
          });

          // Cancel any scheduled/pending follow-up sequence drafts for this contact
          await db.hrFollowUp.updateMany({
            where: { contactId: contact.id, status: 'pending' },
            data: { status: 'cancelled' },
          });

          newlyRepliedCount++;
          repliedContactsList.push(`${contact.name} (${contact.company}) - [${aiAnalysis.classification}]`);
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();

    return NextResponse.json({
      success: true,
      checked: sentContacts.length,
      replied: newlyRepliedCount,
      bounced: newlyBouncedCount,
      repliedList: repliedContactsList,
      bouncedList: bouncedContactsList,
      message: `Audited inbox. Detected ${newlyRepliedCount} new replies and ${newlyBouncedCount} bounced/suppressed contacts.`
    });
  } catch (error: any) {
    console.error('Failed to audit email replies:', error);
    
    let userMessage = 'Failed to check replies. Please try again.';
    if (error.code === 'EAUTH') {
      userMessage = 'Authentication failed. Please verify your Gmail address and verify IMAP is enabled inside Gmail Settings.';
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      userMessage = 'Could not connect to your mail server. Please check your internet connection.';
    }
    
    return NextResponse.json(
      { error: userMessage },
      { status: 500 }
    );
  }
}
