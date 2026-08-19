import crypto from 'crypto';
import { db } from '@/lib/db';

/**
 * Unsubscribe + suppression helpers (multi-tenant).
 *
 * Tokens are HMAC-signed (global secret) so an unsubscribe URL can't be forged.
 * Suppression is per-user (each tenant has its own do-not-contact list).
 */

async function getOrCreateSecret(): Promise<string> {
  if (process.env.UNSUBSCRIBE_SECRET && process.env.UNSUBSCRIBE_SECRET.length >= 16) {
    return process.env.UNSUBSCRIBE_SECRET;
  }
  const gs = await db.globalSetting.findUnique({ where: { id: 'default' } });
  if (gs?.unsubscribeSecret && gs.unsubscribeSecret.length >= 16) {
    return gs.unsubscribeSecret;
  }
  const generated = crypto.randomBytes(32).toString('hex');
  // update:{} means we never overwrite a secret another process may have just written
  await db.globalSetting.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default', unsubscribeSecret: generated },
  });
  // Re-read so every concurrent caller converges on the same stored value
  const stored = await db.globalSetting.findUnique({ where: { id: 'default' } });
  return stored?.unsubscribeSecret || generated;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function sign(contactId: string, secret: string): string {
  return b64url(crypto.createHmac('sha256', secret).update(contactId).digest());
}

export async function generateUnsubscribeToken(contactId: string): Promise<string> {
  const secret = await getOrCreateSecret();
  return `${b64url(contactId)}.${sign(contactId, secret)}`;
}

/** Returns the contactId if the token is valid, else null. */
export async function verifyUnsubscribeToken(token: string): Promise<string | null> {
  if (!token || !token.includes('.')) return null;
  const [idPart, sigPart] = token.split('.');
  let contactId: string;
  try {
    contactId = Buffer.from(idPart.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  } catch {
    return null;
  }
  const secret = await getOrCreateSecret();
  const expected = sign(contactId, secret);
  // Decode base64url → binary before comparing; comparing the ASCII string bytes
  // would give a wrong result because base64url chars are not the raw HMAC bytes.
  const fromB64Url = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const a = fromB64Url(sigPart);
  const b = fromB64Url(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return contactId;
}

/** Add an email to a user's suppression list (idempotent). */
export async function suppressEmail(
  userId: string,
  email: string,
  reason: 'unsubscribe' | 'bounce' | 'manual' | 'complaint' = 'unsubscribe',
  source = ''
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !userId) return;
  await db.suppression.upsert({
    where: { userId_email: { userId, email: normalized } },
    update: {},
    create: { userId, email: normalized, reason, source },
  });
}

export async function isSuppressed(userId: string, email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !userId) return false;
  const hit = await db.suppression.findUnique({
    where: { userId_email: { userId, email: normalized } },
  });
  return !!hit;
}

/** Mark a contact unsubscribed and add them to that tenant's suppression list. */
export async function unsubscribeContact(contactId: string): Promise<{ email: string } | null> {
  const contact = await db.hrContact.findUnique({ where: { id: contactId } });
  if (!contact) return null;
  await db.hrContact.update({
    where: { id: contactId },
    data: { unsubscribed: true, unsubscribedAt: new Date() },
  });
  await suppressEmail(contact.userId, contact.email, 'unsubscribe', contactId);
  return { email: contact.email };
}
