/**
 * @module gemini-research
 * Gemini API wrapper with Google Search grounding for company intelligence.
 * Uses `gemini-2.5-flash` (500 RPD free tier) with automatic fallback to `gemini-2.0-flash`.
 */

// ─── Public interfaces ─────────────────────────────────────────────────────────

export interface CompanyProfile {
  companyName: string;
  industry: string;
  description: string;
  headquarters: string;
  founded: string;
  products: string[];
  revenueStage: string;
  employeeCount: string;
  recentNews: string[];
  socialLinks: { linkedin?: string; twitter?: string };
}

export interface DiscoveredPerson {
  name: string;
  role: string;
  department: string;
  linkedinUrl: string;
  confidence: number;
  source: string;
}

export interface GeminiResearchResult<T> {
  data: T;
  groundingSources: { title: string; url: string }[];
  searchQueries: string[];
}

// ─── Internal types ─────────────────────────────────────────────────────────────

interface GeminiGroundingChunk {
  web?: { uri?: string; title?: string };
}

interface GeminiGroundingMetadata {
  groundingChunks?: GeminiGroundingChunk[];
  webSearchQueries?: string[];
}

interface GeminiCandidate {
  content?: { parts?: { text?: string }[] };
  groundingMetadata?: GeminiGroundingMetadata;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const PRIMARY_MODEL = 'gemini-2.5-flash';
const FALLBACK_MODEL = 'gemini-2.0-flash';

function buildEndpoint(model: string, apiKey: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Extracts a JSON value from potentially markdown-wrapped LLM text.
 * Tries raw `JSON.parse` first, then falls back to extracting from fenced code blocks.
 *
 * @param text - Raw text from the Gemini response.
 * @returns Parsed JSON value, or `null` if extraction fails.
 */
export function parseJsonFromText(text: string): unknown {
  // 1) Try direct parse of the full string
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* continue */
  }

  // 2) Try to extract JSON from markdown fenced code blocks (```json ... ``` or ``` ... ```)
  const codeBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)```/;
  const cbMatch = trimmed.match(codeBlockRegex);
  if (cbMatch?.[1]) {
    try {
      return JSON.parse(cbMatch[1].trim());
    } catch {
      /* continue */
    }
  }

  // 3) Try to find the first { ... } or [ ... ] span
  const firstBrace = trimmed.indexOf('{');
  const firstBracket = trimmed.indexOf('[');
  const start =
    firstBrace === -1
      ? firstBracket
      : firstBracket === -1
        ? firstBrace
        : Math.min(firstBrace, firstBracket);

  if (start !== -1) {
    const opener = trimmed[start];
    const closer = opener === '{' ? '}' : ']';
    const lastClose = trimmed.lastIndexOf(closer);
    if (lastClose > start) {
      try {
        return JSON.parse(trimmed.slice(start, lastClose + 1));
      } catch {
        /* fall through */
      }
    }
  }

  return null;
}

/**
 * Extracts grounding sources from the Gemini response metadata.
 */
function extractGroundingSources(
  metadata?: GeminiGroundingMetadata,
): GeminiResearchResult<unknown>['groundingSources'] {
  if (!metadata?.groundingChunks) return [];
  return metadata.groundingChunks
    .filter((c) => c.web?.uri)
    .map((c) => ({
      title: c.web?.title ?? '',
      url: c.web?.uri ?? '',
    }));
}

/**
 * Calls the Gemini generateContent API with Google Search grounding.
 * Handles 429 (rate limit → retry after delay) and 503 (overload → fallback model).
 */
async function callGemini(apiKey: string, prompt: string): Promise<GeminiResponse> {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    tools: [{ googleSearch: {} }],
  };

  // Attempt with primary model
  const primaryUrl = buildEndpoint(PRIMARY_MODEL, apiKey);
  let response = await fetch(primaryUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  // Handle 429 – rate limited: wait and retry once
  if (response.status === 429) {
    const retryAfterHeader = response.headers.get('Retry-After');
    const retryDelayMs = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : 10_000;
    const waitMs = Math.min(retryDelayMs, 60_000); // cap at 60 s
    await new Promise((resolve) => setTimeout(resolve, waitMs));

    response = await fetch(primaryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  // Handle 503 – overloaded: fallback to secondary model
  if (response.status === 503) {
    const fallbackUrl = buildEndpoint(FALLBACK_MODEL, apiKey);
    response = await fetch(fallbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Gemini API error ${response.status}: ${errorBody.slice(0, 500)}`);
  }

  return (await response.json()) as GeminiResponse;
}

/**
 * Extracts the text content from a Gemini response.
 */
function extractResponseText(data: GeminiResponse): string {
  const parts = data.candidates?.[0]?.content?.parts;
  if (!parts?.length) return '';
  return parts.map((p) => p.text ?? '').join('');
}

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Researches a company using Gemini with Google Search grounding.
 * Combines crawled page data with live search results to build a structured profile.
 *
 * @param apiKey - Google AI / Gemini API key.
 * @param companyUrl - The company's website URL.
 * @param crawlData - Pre-crawled data from the company website (title, description, rawText).
 * @returns A grounded `CompanyProfile` with source citations.
 *
 * @example
 * ```ts
 * const result = await researchCompany(apiKey, 'https://stripe.com', crawlData);
 * console.log(result.data.industry); // "Financial Technology"
 * ```
 */
export async function researchCompany(
  apiKey: string,
  companyUrl: string,
  crawlData: { title: string; description: string; rawText: string },
): Promise<GeminiResearchResult<CompanyProfile>> {
  const prompt = `You are a B2B sales intelligence analyst. Research the company at ${companyUrl} using Google Search.

Here is data already crawled from their website:
- Page Title: ${crawlData.title}
- Meta Description: ${crawlData.description}
- Page Content (excerpt): ${crawlData.rawText.slice(0, 2000)}

Using Google Search for the most up-to-date information, build a comprehensive company profile.

Return your answer as a single JSON object (no markdown, no explanation) with exactly these fields:
{
  "companyName": "string",
  "industry": "string (e.g. 'Financial Technology', 'Healthcare SaaS')",
  "description": "string (2-3 sentence summary of what the company does)",
  "headquarters": "string (city, state/country)",
  "founded": "string (year or 'Unknown')",
  "products": ["string (main products or services, up to 5)"],
  "revenueStage": "string (e.g. 'Pre-revenue', 'Seed', 'Series A', 'Series B', 'Growth', 'Public', 'Unknown')",
  "employeeCount": "string (e.g. '50-100', '1000+', 'Unknown')",
  "recentNews": ["string (up to 3 recent news headlines or events)"],
  "socialLinks": { "linkedin": "string or null", "twitter": "string or null" }
}`;

  const emptyProfile: CompanyProfile = {
    companyName: crawlData.title || '',
    industry: '',
    description: crawlData.description || '',
    headquarters: '',
    founded: '',
    products: [],
    revenueStage: 'Unknown',
    employeeCount: 'Unknown',
    recentNews: [],
    socialLinks: {},
  };

  try {
    const response = await callGemini(apiKey, prompt);
    const text = extractResponseText(response);
    const metadata = response.candidates?.[0]?.groundingMetadata;

    const parsed = parseJsonFromText(text);
    const profile: CompanyProfile = parsed
      ? {
          companyName: (parsed as Record<string, unknown>).companyName as string ?? emptyProfile.companyName,
          industry: (parsed as Record<string, unknown>).industry as string ?? '',
          description: (parsed as Record<string, unknown>).description as string ?? emptyProfile.description,
          headquarters: (parsed as Record<string, unknown>).headquarters as string ?? '',
          founded: (parsed as Record<string, unknown>).founded as string ?? '',
          products: Array.isArray((parsed as Record<string, unknown>).products) ? (parsed as Record<string, unknown>).products as string[] : [],
          revenueStage: (parsed as Record<string, unknown>).revenueStage as string ?? 'Unknown',
          employeeCount: (parsed as Record<string, unknown>).employeeCount as string ?? 'Unknown',
          recentNews: Array.isArray((parsed as Record<string, unknown>).recentNews) ? (parsed as Record<string, unknown>).recentNews as string[] : [],
          socialLinks: (parsed as Record<string, unknown>).socialLinks as CompanyProfile['socialLinks'] ?? {},
        }
      : emptyProfile;

    return {
      data: profile,
      groundingSources: extractGroundingSources(metadata),
      searchQueries: metadata?.webSearchQueries ?? [],
    };
  } catch (err) {
    console.error('[gemini-research] researchCompany failed:', err);
    return { data: emptyProfile, groundingSources: [], searchQueries: [] };
  }
}

/**
 * Discovers key decision makers at a company using Gemini with Google Search grounding.
 * Finds leadership roles (CEO, CTO, VP Eng, etc.) and attempts to locate their LinkedIn profiles.
 *
 * @param apiKey - Google AI / Gemini API key.
 * @param companyName - The company name.
 * @param industry - The company's industry (for context).
 * @param companyUrl - The company's website URL.
 * @returns A grounded list of `DiscoveredPerson` entries with confidence scores.
 *
 * @example
 * ```ts
 * const result = await discoverDecisionMakers(apiKey, 'Stripe', 'Fintech', 'https://stripe.com');
 * for (const person of result.data) {
 *   console.log(`${person.name} - ${person.role} (confidence: ${person.confidence})`);
 * }
 * ```
 */
export async function discoverDecisionMakers(
  apiKey: string,
  companyName: string,
  industry: string,
  companyUrl: string,
): Promise<GeminiResearchResult<DiscoveredPerson[]>> {
  const prompt = `You are a B2B sales intelligence analyst specializing in finding key decision makers at companies.

Company: ${companyName}
Industry: ${industry}
Website: ${companyUrl}

Using Google Search, find the leadership team and key decision makers at this company. Specifically look for people in these roles:
- CEO / Co-founder / Founder
- CTO / VP Engineering / Head of Engineering
- Head of Product / VP Product
- Head of Marketing / CMO / VP Marketing
- Sales Director / VP Sales / Head of Sales
- CFO / VP Finance

For each person found, try to find their LinkedIn profile URL.

Assign a confidence score (0-100) based on source quality:
- 90-100: Found on the company's official website or verified LinkedIn
- 70-89: Found in recent credible news articles or press releases
- 50-69: Found in older articles or less authoritative sources
- 30-49: Inferred or found in unverified sources
- 0-29: Speculative

Return your answer as a JSON array (no markdown, no explanation). Each element should have:
[
  {
    "name": "string (full name)",
    "role": "string (job title)",
    "department": "string (e.g. 'Engineering', 'Marketing', 'Executive', 'Sales', 'Product', 'Finance')",
    "linkedinUrl": "string (LinkedIn profile URL, or empty string if not found)",
    "confidence": number,
    "source": "string (where this info was found, e.g. 'Company website', 'LinkedIn', 'TechCrunch article')"
  }
]

If you cannot find any decision makers, return an empty array: []`;

  try {
    const response = await callGemini(apiKey, prompt);
    const text = extractResponseText(response);
    const metadata = response.candidates?.[0]?.groundingMetadata;

    const parsed = parseJsonFromText(text);
    const people: DiscoveredPerson[] = Array.isArray(parsed)
      ? parsed.map((p: Record<string, unknown>) => ({
          name: (p.name as string) ?? '',
          role: (p.role as string) ?? '',
          department: (p.department as string) ?? '',
          linkedinUrl: (p.linkedinUrl as string) ?? '',
          confidence: typeof p.confidence === 'number' ? p.confidence : 0,
          source: (p.source as string) ?? '',
        }))
      : [];

    return {
      data: people,
      groundingSources: extractGroundingSources(metadata),
      searchQueries: metadata?.webSearchQueries ?? [],
    };
  } catch (err) {
    console.error('[gemini-research] discoverDecisionMakers failed:', err);
    return { data: [], groundingSources: [], searchQueries: [] };
  }
}
