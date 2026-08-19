/**
 * Lightweight pre-send deliverability / spam-content checker.
 *
 * Pure heuristic (no external API). Returns a 0–100 score (higher = safer) plus
 * human-readable issues, mirroring the "Sequence Score / Spam Checker" that
 * tools like Saleshandy, Mailshake and Instantly show before sending.
 */

export type SpamIssue = {
  severity: 'high' | 'medium' | 'low';
  message: string;
};

export type SpamReport = {
  score: number; // 0–100, higher is better
  rating: 'excellent' | 'good' | 'fair' | 'poor';
  issues: SpamIssue[];
  stats: {
    words: number;
    links: number;
    spamWords: string[];
    capsRatio: number;
    exclamations: number;
  };
};

// Common spam-trigger phrases (density matters more than any single hit).
const SPAM_WORDS = [
  'act now', 'apply now', 'buy now', 'order now', 'click here', 'click below',
  'free', 'free trial', 'risk-free', 'no cost', 'no fees', 'money back',
  '100%', 'guarantee', 'guaranteed', 'limited time', 'urgent', 'congratulations',
  'winner', 'cash', 'cheap', 'discount', 'earn money', 'extra income',
  'make money', 'million', 'lowest price', 'best price', 'offer expires',
  'increase sales', 'increase traffic', 'this isn\'t spam', 'not spam',
  'amazing', 'incredible deal', 'once in a lifetime', 'why pay more',
  'double your', 'extra cash', 'fast cash', 'instant', 'opportunity',
  'pre-approved', 'special promotion', 'while supplies last', 'order today',
];

function countLinks(text: string): number {
  const matches = text.match(/https?:\/\/[^\s<>"')]+/gi);
  return matches ? matches.length : 0;
}

export function analyzeEmail(subject: string, body: string): SpamReport {
  const issues: SpamIssue[] = [];
  const subj = (subject || '').trim();
  const text = (body || '').trim();
  const combined = `${subj}\n${text}`;
  const lower = combined.toLowerCase();

  const words = text ? text.split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length;
  const links = countLinks(text);

  // Spam words
  const foundSpam = SPAM_WORDS.filter((w) => lower.includes(w));

  // CAPS ratio (over letters only)
  const letters = combined.replace(/[^a-zA-Z]/g, '');
  const caps = combined.replace(/[^A-Z]/g, '');
  const capsRatio = letters.length > 0 ? caps.length / letters.length : 0;

  // Exclamation marks
  const exclamations = (combined.match(/!/g) || []).length;

  let score = 100;

  if (!subj) {
    issues.push({ severity: 'high', message: 'Missing subject line.' });
    score -= 25;
  } else if (subj.length > 70) {
    issues.push({ severity: 'low', message: `Subject is long (${subj.length} chars) — aim for under ~60.` });
    score -= 5;
  }

  if (subj && /^(re:|fwd:)/i.test(subj)) {
    issues.push({ severity: 'medium', message: 'Subject fakes a reply ("Re:/Fwd:") — deceptive subjects violate CAN-SPAM.' });
    score -= 10;
  }

  if (wordCount === 0) {
    issues.push({ severity: 'high', message: 'Email body is empty.' });
    score -= 40;
  } else if (wordCount < 20) {
    issues.push({ severity: 'low', message: `Very short body (${wordCount} words) — may look thin.` });
    score -= 5;
  } else if (wordCount > 250) {
    issues.push({ severity: 'low', message: `Long body (${wordCount} words) — cold emails do best under ~150.` });
    score -= 5;
  }

  if (foundSpam.length > 0) {
    const sev = foundSpam.length >= 4 ? 'high' : foundSpam.length >= 2 ? 'medium' : 'low';
    issues.push({
      severity: sev,
      message: `Contains ${foundSpam.length} spam-trigger phrase${foundSpam.length > 1 ? 's' : ''}: ${foundSpam.slice(0, 6).join(', ')}.`,
    });
    score -= Math.min(40, foundSpam.length * 8);
  }

  if (links > 3) {
    issues.push({ severity: 'medium', message: `${links} links — keep to ~2–3 clean links in cold email.` });
    score -= Math.min(20, (links - 3) * 6);
  }

  if (capsRatio > 0.35 && letters.length > 30) {
    issues.push({ severity: 'medium', message: `Heavy use of CAPS (${Math.round(capsRatio * 100)}%) reads as shouty/spammy.` });
    score -= 12;
  }

  if (exclamations >= 3) {
    issues.push({ severity: 'low', message: `${exclamations} exclamation marks — tone it down for cold outreach.` });
    score -= Math.min(10, exclamations * 2);
  }

  if (/\$\s?\d|\d+\s?(usd|dollars)/i.test(combined)) {
    issues.push({ severity: 'low', message: 'Mentions money amounts — common spam signal in cold email.' });
    score -= 4;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const rating: SpamReport['rating'] =
    score >= 85 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'fair' : 'poor';

  if (issues.length === 0) {
    issues.push({ severity: 'low', message: 'Looks clean — no major spam signals detected.' });
  }

  return {
    score,
    rating,
    issues,
    stats: { words: wordCount, links, spamWords: foundSpam, capsRatio, exclamations },
  };
}
