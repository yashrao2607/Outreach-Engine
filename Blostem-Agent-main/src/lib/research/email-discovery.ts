/**
 * @module email-discovery
 * Email pattern generation and DNS verification utilities for B2B outreach.
 * Generates probable email addresses from name + domain and verifies domain MX records.
 */

import { resolveMx } from 'node:dns/promises';

// ─── Public interfaces ─────────────────────────────────────────────────────────

export interface EmailCandidate {
  email: string;
  pattern: string;
  confidence: number;
}

// ─── Internal helpers ───────────────────────────────────────────────────────────

/**
 * Strips accents, special characters, and whitespace from a name component,
 * returning a lowercase ASCII-safe string.
 */
function sanitizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-zA-Z]/g, '') // remove non-alpha
    .toLowerCase();
}

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Generates probable email addresses for a person at a given domain.
 * Returns candidates sorted by confidence (highest first).
 *
 * Patterns generated:
 * | Pattern            | Example              | Confidence |
 * |--------------------|----------------------|------------|
 * | `first.last`       | john.doe@acme.com    | 85         |
 * | `firstlast`        | johndoe@acme.com     | 75         |
 * | `first`            | john@acme.com        | 70         |
 * | `flast`            | jdoe@acme.com        | 65         |
 * | `firstl`           | johnd@acme.com       | 60         |
 * | `last.first`       | doe.john@acme.com    | 50         |
 * | `first_last`       | john_doe@acme.com    | 45         |
 *
 * @param firstName - The person's first name.
 * @param lastName - The person's last name.
 * @param domain - The company's email domain (e.g. `acme.com`).
 * @returns An array of `EmailCandidate` objects, sorted by descending confidence.
 *
 * @example
 * ```ts
 * const candidates = generateEmailPatterns('John', 'Doe', 'acme.com');
 * // candidates[0].email === 'john.doe@acme.com'
 * // candidates[0].confidence === 85
 * ```
 */
export function generateEmailPatterns(
  firstName: string,
  lastName: string,
  domain: string,
): EmailCandidate[] {
  const first = sanitizeName(firstName);
  const last = sanitizeName(lastName);

  if (!first || !last || !domain) {
    return [];
  }

  const f = first[0]; // first initial
  const l = last[0]; // last initial

  const patterns: { template: string; confidence: number }[] = [
    { template: `${first}.${last}`, confidence: 85 },
    { template: `${first}${last}`, confidence: 75 },
    { template: `${first}`, confidence: 70 },
    { template: `${f}${last}`, confidence: 65 },
    { template: `${first}${l}`, confidence: 60 },
    { template: `${last}.${first}`, confidence: 50 },
    { template: `${first}_${last}`, confidence: 45 },
  ];

  const cleanDomain = domain.toLowerCase().replace(/^@/, '');

  return patterns.map(({ template, confidence }) => ({
    email: `${template}@${cleanDomain}`,
    pattern: template.replace(first, 'first').replace(last, 'last').replace(f, 'f').replace(l, 'l'),
    confidence,
  }));
}

/**
 * Checks whether a domain has valid MX (mail exchanger) records.
 * A domain with MX records can receive email, which means generated email
 * addresses for that domain are more likely to be deliverable.
 *
 * @param domain - The domain to verify (e.g. `acme.com`).
 * @returns `true` if the domain has at least one MX record, `false` otherwise.
 *
 * @example
 * ```ts
 * const hasMx = await verifyDomainMX('google.com');
 * console.log(hasMx); // true
 * ```
 */
export async function verifyDomainMX(domain: string): Promise<boolean> {
  try {
    const records = await resolveMx(domain);
    return Array.isArray(records) && records.length > 0;
  } catch {
    return false;
  }
}

/**
 * Extracts the bare domain from a URL string.
 * Handles URLs with or without a protocol prefix.
 *
 * @param url - A URL string (e.g. `https://stripe.com/about` or `stripe.com`).
 * @returns The domain portion of the URL (e.g. `stripe.com`).
 *
 * @example
 * ```ts
 * extractDomainFromUrl('https://www.stripe.com/about'); // 'www.stripe.com'
 * extractDomainFromUrl('stripe.com');                    // 'stripe.com'
 * ```
 */
export function extractDomainFromUrl(url: string): string {
  try {
    // If there's no protocol, prepend one so the URL constructor can parse it
    const withProtocol = url.match(/^https?:\/\//) ? url : `https://${url}`;
    const parsed = new URL(withProtocol);
    return parsed.hostname;
  } catch {
    // Last-resort fallback: strip protocol-like prefixes and take the first path segment
    return url.replace(/^(?:https?:\/\/)?/, '').split('/')[0];
  }
}
