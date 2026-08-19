/**
 * @module crawler
 * Website crawling engine for extracting company information from web pages.
 * Uses native fetch() with regex-based HTML parsing — no external dependencies.
 */

export interface CrawlResult {
  title: string;
  description: string;
  emails: string[];
  socialLinks: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    github?: string;
  };
  aboutPageLinks: { text: string; href: string }[];
  companyName: string;
  rawText: string;
}

/** Chrome-like User-Agent to avoid bot-detection blocks. */
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

/** Image file extensions to exclude from email matches. */
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp']);

/** Regex for about/team/leadership/contact page links. */
const ABOUT_PAGE_PATTERN =
  /\b(about|team|leadership|our-team|management|staff|contact|people|who-we-are|company)\b/i;

// ─── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Resolves a potentially relative href to an absolute URL.
 */
function resolveUrl(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return '';
  }
}

/**
 * Extracts the content of an HTML tag attribute.
 * Returns the first match or an empty string.
 */
function extractMetaContent(html: string, nameOrProperty: string): string {
  // Handles both name="..." and property="..." attributes in either order
  const patterns = [
    new RegExp(
      `<meta[^>]*(?:name|property)=["']${nameOrProperty}["'][^>]*content=["']([^"']*)["']`,
      'i',
    ),
    new RegExp(
      `<meta[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${nameOrProperty}["']`,
      'i',
    ),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return '';
}

/**
 * Extracts the page <title>.
 */
function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

/**
 * Finds all email addresses in the HTML, filtering out image files and example domains.
 */
function extractEmails(html: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = html.match(emailRegex) ?? [];

  const seen = new Set<string>();
  const results: string[] = [];

  for (const raw of matches) {
    const email = raw.toLowerCase();
    if (seen.has(email)) continue;

    // Skip image-like addresses (e.g. logo@2x.png)
    const ext = email.split('.').pop() ?? '';
    if (IMAGE_EXTENSIONS.has(ext)) continue;

    // Skip example/placeholder addresses
    if (email.includes('example')) continue;

    seen.add(email);
    results.push(email);
  }

  return results;
}

/**
 * Finds social media profile links in the HTML.
 */
function extractSocialLinks(html: string): CrawlResult['socialLinks'] {
  const links: CrawlResult['socialLinks'] = {};

  const patterns: { key: keyof CrawlResult['socialLinks']; re: RegExp }[] = [
    { key: 'linkedin', re: /https?:\/\/(?:www\.)?linkedin\.com\/company\/[a-zA-Z0-9_-]+\/?/gi },
    { key: 'twitter', re: /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[a-zA-Z0-9_]+\/?/gi },
    { key: 'facebook', re: /https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9._-]+\/?/gi },
    { key: 'github', re: /https?:\/\/(?:www\.)?github\.com\/[a-zA-Z0-9_-]+\/?/gi },
  ];

  for (const { key, re } of patterns) {
    const m = html.match(re);
    if (m?.[0]) {
      links[key] = m[0];
    }
  }

  return links;
}

/**
 * Finds links to about / team / leadership / contact pages.
 */
function extractAboutPageLinks(html: string, baseUrl: string): CrawlResult['aboutPageLinks'] {
  const anchorRegex = /<a\s[^>]*href=["']([^"'#]*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const results: CrawlResult['aboutPageLinks'] = [];
  const seenHrefs = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = anchorRegex.exec(html)) !== null) {
    const rawHref = match[1];
    const rawText = match[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

    if (!rawHref || !rawText) continue;
    if (!ABOUT_PAGE_PATTERN.test(rawHref) && !ABOUT_PAGE_PATTERN.test(rawText)) continue;

    const absoluteHref = resolveUrl(rawHref, baseUrl);
    if (!absoluteHref || seenHrefs.has(absoluteHref)) continue;

    seenHrefs.add(absoluteHref);
    results.push({ text: rawText, href: absoluteHref });
  }

  return results;
}

/**
 * Derives a company name from available metadata.
 * Priority: og:site_name → cleaned <title> → domain name.
 */
function deriveCompanyName(html: string, title: string, url: string): string {
  const ogSiteName = extractMetaContent(html, 'og:site_name');
  if (ogSiteName) return ogSiteName;

  // Try to clean common title suffixes like " | Home", " - Welcome", etc.
  if (title) {
    const cleaned = title.split(/\s*[|\-–—:]\s*/)[0].trim();
    if (cleaned.length > 1 && cleaned.length < 80) return cleaned;
  }

  // Fallback to domain
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return hostname.split('.')[0].charAt(0).toUpperCase() + hostname.split('.')[0].slice(1);
  } catch {
    return '';
  }
}

/**
 * Strips HTML tags and collapses whitespace to produce condensed page text.
 */
function extractRawText(html: string, maxLength: number = 3000): string {
  let text = html;
  // Remove script and style blocks entirely
  text = text.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text.slice(0, maxLength);
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Crawls a company website and extracts structured data for outreach intelligence.
 *
 * @param url - The full URL of the company website to crawl.
 * @returns A `CrawlResult` containing extracted metadata, emails, social links, and page text.
 *
 * @example
 * ```ts
 * const result = await crawlCompanyWebsite('https://stripe.com');
 * console.log(result.companyName); // "Stripe"
 * console.log(result.emails);      // ["sales@stripe.com", ...]
 * ```
 */
export async function crawlCompanyWebsite(url: string): Promise<CrawlResult> {
  // Ensure the URL has a protocol
  const normalizedUrl = url.match(/^https?:\/\//) ? url : `https://${url}`;

  const empty: CrawlResult = {
    title: '',
    description: '',
    emails: [],
    socialLinks: {},
    aboutPageLinks: [],
    companyName: '',
    rawText: '',
  };

  let html: string;
  try {
    const response = await fetch(normalizedUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      console.error(`[crawler] HTTP ${response.status} for ${normalizedUrl}`);
      return empty;
    }

    html = await response.text();
  } catch (err) {
    console.error(`[crawler] Fetch failed for ${normalizedUrl}:`, err);
    return empty;
  }

  // Extract each piece independently so one failure doesn't block the rest
  let title = '';
  try {
    title = extractTitle(html);
  } catch {
    /* swallow */
  }

  let description = '';
  try {
    description =
      extractMetaContent(html, 'description') || extractMetaContent(html, 'og:description');
  } catch {
    /* swallow */
  }

  let emails: string[] = [];
  try {
    emails = extractEmails(html);
  } catch {
    /* swallow */
  }

  let socialLinks: CrawlResult['socialLinks'] = {};
  try {
    socialLinks = extractSocialLinks(html);
  } catch {
    /* swallow */
  }

  let aboutPageLinks: CrawlResult['aboutPageLinks'] = [];
  try {
    aboutPageLinks = extractAboutPageLinks(html, normalizedUrl);
  } catch {
    /* swallow */
  }

  let companyName = '';
  try {
    companyName = deriveCompanyName(html, title, normalizedUrl);
  } catch {
    /* swallow */
  }

  let rawText = '';
  try {
    rawText = extractRawText(html);
  } catch {
    /* swallow */
  }

  return {
    title,
    description,
    emails,
    socialLinks,
    aboutPageLinks,
    companyName,
    rawText,
  };
}
