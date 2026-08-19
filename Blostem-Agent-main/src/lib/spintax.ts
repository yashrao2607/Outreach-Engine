/**
 * Spintax + merge-tag expansion.
 *
 * Spintax:  {Hi|Hello|Hey} {there|friend}  -> one random pick per send, so bulk
 *           sends don't all carry identical content (a spam-filter fingerprint).
 *           Supports nesting.
 *
 * Merge tags: {{firstName}} or {{firstName|there}} (fallback after the pipe).
 */

export type MergeValues = Record<string, string | null | undefined>;

/** Expand {a|b|c} spintax, innermost first, picking one option at random. */
export function expandSpintax(input: string, rand: () => number = Math.random): string {
  if (!input || input.indexOf('{') === -1) return input;
  let text = input;
  // Innermost groups have no nested braces inside them.
  const group = /\{([^{}]*\|[^{}]*)\}/;
  let guard = 0;
  while (group.test(text) && guard < 1000) {
    text = text.replace(group, (_m, body: string) => {
      const options = body.split('|');
      return options[Math.floor(rand() * options.length)] ?? '';
    });
    guard++;
  }
  return text;
}

/** Replace {{key}} / {{key|fallback}} with values; unknown keys -> fallback or ''. */
export function applyMergeTags(input: string, values: MergeValues): string {
  if (!input || input.indexOf('{{') === -1) return input;
  return input.replace(/\{\{\s*([\w.]+)\s*(?:\|\s*([^}]*?))?\s*\}\}/g, (_m, key: string, fallback?: string) => {
    const raw = values[key];
    const val = raw == null ? '' : String(raw).trim();
    if (val) return val;
    return (fallback ?? '').trim();
  });
}

/** Merge tags first, then spintax. */
export function renderTemplate(input: string, values: MergeValues, rand: () => number = Math.random): string {
  return expandSpintax(applyMergeTags(input, values), rand);
}
