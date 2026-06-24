import { resolveDate, Period } from './dateResolver';
import { matchCategory, Category } from './categoryMatcher';
import { normalizeNumberWords } from './numberWords';

export type Action = 'ADD' | 'QUERY' | 'CREATE_CATEGORY' | 'EXPORT' | 'UNKNOWN';

export type ParsedIntent = {
  action: Action;
  amount: number | null;
  category: string | null;
  categoryId: number | null;  // resolved from DB categories; null if unknown
  date: string;               // ISO 8601, never null
  period: Period | null;
  // CREATE_CATEGORY extras
  newCategoryName: string | null;
  newCategoryParent: string | null;
};

type PatternResult = { category: string; amount: number } | null;

// ── helpers ───────────────────────────────────────────────────────────────────

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/,/g, ''));
}

// Temporal / connective words that must never end up inside a category name.
// Date extraction strips full phrases up front, but a greedy capture can still
// grab a leftover fragment ("grocery last", "snacks last", "ago gym"). This is
// the safety net: strip these tokens from the edges of a category capture.
const TEMPORAL_STOPWORDS = new Set([
  'last', 'this', 'next', 'ago', 'back', 'week', 'weeks', 'month', 'months',
  'day', 'days', 'year', 'years', 'today', 'yesterday', 'tomorrow',
  'on', 'in', 'for', 'to', 'of', 'a', 'the', 'my', 'and', 'paid', 'spent',
  'done', 'rupees', 'rupee', 'rs', 'add', 'log',
]);

// Trim temporal/filler tokens from both ends of a captured category string and
// drop any embedded "[unk]" tokens, leaving the real category words.
function cleanCategoryCapture(raw: string): string {
  let words = raw
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w && w !== '[unk]');
  while (words.length && TEMPORAL_STOPWORDS.has(words[0])) words = words.slice(1);
  while (words.length && TEMPORAL_STOPWORDS.has(words[words.length - 1])) words = words.slice(0, -1);
  return words.join(' ');
}

function emptyIntent(date: string): ParsedIntent {
  return {
    action: 'UNKNOWN',
    amount: null,
    category: null,
    categoryId: null,
    date,
    period: null,
    newCategoryName: null,
    newCategoryParent: null,
  };
}

// ── ADD patterns ──────────────────────────────────────────────────────────────
// Each entry: [regex, extractor]
// All patterns operate on the *cleaned* text (date phrases already stripped).

type PatternEntry = [RegExp, (m: RegExpMatchArray) => PatternResult];

const ADD_PATTERNS: PatternEntry[] = [
  // "spent/paid <amount> [rupees/rs] on/for <category>"
  [
    /\b(?:spent|paid)\s+([\d,]+(?:\.\d+)?)\s*(?:rupees?|rs\.?)?\s+(?:on|for)\s+(\w+(?:\s+\w+)?)\b/i,
    (m) => ({ amount: parseAmount(m[1]), category: m[2] }),
  ],
  // "spent/paid <amount> <category>"  (no preposition)
  [
    /\b(?:spent|paid)\s+([\d,]+(?:\.\d+)?)\s*(?:rupees?|rs\.?)?\s+(\w+(?:\s+\w+)?)\b/i,
    (m) => ({ amount: parseAmount(m[1]), category: m[2] }),
  ],
  // "add/log <amount> [rupees/rs] to/in/for <category>"
  [
    /\b(?:add|log)\s+([\d,]+(?:\.\d+)?)\s*(?:rupees?|rs\.?)?\s+(?:to|in|for)\s+(\w+(?:\s+\w+)?)\b/i,
    (m) => ({ amount: parseAmount(m[1]), category: m[2] }),
  ],
  // "paid <category> <amount>"  e.g. "paid rent 15000"
  [
    /\bpaid\s+(\w+(?:\s+\w+)?)\s+([\d,]+(?:\.\d+)?)\s*(?:rupees?|rs\.?)?\b/i,
    (m) => ({ amount: parseAmount(m[2]), category: m[1] }),
  ],
  // "<amount> rupees/rs <category>"
  [
    /\b([\d,]+(?:\.\d+)?)\s+(?:rupees?|rs\.?)\s+(\w+(?:\s+\w+)?)\b/i,
    (m) => ({ amount: parseAmount(m[1]), category: m[2] }),
  ],
  // "<category> <amount> [rupees/rs] [paid/spent/done]"
  [
    /\b(\w+(?:\s+\w+)?)\s+([\d,]+(?:\.\d+)?)\s*(?:rupees?|rs\.?)?\s*(?:paid|spent|done)?\b/i,
    (m) => ({ amount: parseAmount(m[2]), category: m[1] }),
  ],
];

// ── QUERY patterns ────────────────────────────────────────────────────────────

type QueryResult = { category: string | null } | null;

type QueryPatternEntry = [RegExp, (m: RegExpMatchArray) => QueryResult];

const QUERY_PATTERNS: QueryPatternEntry[] = [
  // "how much spent on <category>"
  [
    /\bhow much (?:spent|did i spend|have i spent)\s+(?:on|for)?\s*(\w+(?:\s+\w+)?)\b/i,
    (m) => ({ category: m[1] }),
  ],
  // "total <category>"
  [
    /\btotal\s+(\w+(?:\s+\w+)?)\b/i,
    (m) => ({ category: m[1] }),
  ],
  // "what was my bill"
  [
    /\bwhat was my bill\b/i,
    () => ({ category: null }),
  ],
  // "show expenses" / "list spending" / "show spending"
  [
    /\b(?:show|list)\s+(?:expenses?|spending|transactions?)\b/i,
    () => ({ category: null }),
  ],
  // "<category> spending" / "<category> expenses"
  [
    /\b(\w+(?:\s+\w+)?)\s+(?:spending|expenses?)\b/i,
    (m) => ({ category: m[1] }),
  ],
];

// ── main parser ───────────────────────────────────────────────────────────────

export function parseIntent(rawText: string, categories: Category[]): ParsedIntent {
  const { date, period, cleaned } = resolveDate(rawText);
  // Vosk emits spoken numbers as WORDS ("five hundred"), never digits — convert
  // them to digit strings so the digit-based ADD/QUERY regexes match. Date words
  // are already stripped by resolveDate, so this never touches a date phrase.
  const text = normalizeNumberWords(cleaned.trim().toLowerCase());

  const base = emptyIntent(date);

  // ── CREATE_CATEGORY ────────────────────────────────────────────────────────
  {
    const re = /\bcreate category\s+(\w+(?:\s+\w+)?)\s+under\s+(\w+(?:\s+\w+)?)\b/i;
    const m = text.match(re);
    if (m) {
      return {
        ...base,
        action: 'CREATE_CATEGORY',
        period,
        newCategoryName: m[1].trim(),
        newCategoryParent: m[2].trim(),
      };
    }
  }

  // ── EXPORT ─────────────────────────────────────────────────────────────────
  {
    const re = /\bexport\b/i;
    if (re.test(text)) {
      return {
        ...base,
        action: 'EXPORT',
        period: period ?? 'this_month',
      };
    }
  }

  // ── QUERY ──────────────────────────────────────────────────────────────────
  {
    const isQueryKeyword =
      /\b(?:how much|total|what was my bill|show|list)\b/i.test(text) ||
      /\b(?:spending|expenses?)\b/i.test(text);

    if (isQueryKeyword) {
      for (const [re, extract] of QUERY_PATTERNS) {
        const m = text.match(re);
        if (m) {
          const result = extract(m);
          if (result === null) continue;

          const catName = result.category;
          let matched: Category | null = null;
          // Strip leftover temporal/filler tokens ("snacks last" → "snacks").
          const cleanCat = catName ? cleanCategoryCapture(catName) : '';
          if (cleanCat) {
            matched = matchCategory(cleanCat, categories);
          }

          return {
            ...base,
            action: 'QUERY',
            period: period ?? 'this_month',
            category: matched?.name ?? (cleanCat || null),
            categoryId: matched?.id ?? null,
          };
        }
      }
    }
  }

  // ── ADD ────────────────────────────────────────────────────────────────────
  for (const [re, extract] of ADD_PATTERNS) {
    const m = text.match(re);
    if (!m) continue;

    const result = extract(m);
    if (!result) continue;

    const { amount, category: catRaw } = result;
    if (!amount || amount <= 0) continue;

    // Strip leftover temporal/filler tokens ("grocery last" → "grocery") and
    // reject empty / pure-number captures.
    const catClean = cleanCategoryCapture(catRaw);
    if (!catClean || /^\d+$/.test(catClean)) continue;

    const matched = matchCategory(catClean, categories);

    return {
      ...base,
      action: 'ADD',
      amount,
      period,
      category: matched?.name ?? catRaw.trim(),
      categoryId: matched?.id ?? null,
    };
  }

  // ── ADD with missing amount ──────────────────────────────────────────────────
  // The ADD patterns above all require a number, so "gym" or "gym paid" (a known
  // category with no amount) would otherwise fall through to UNKNOWN. Detect that
  // case so the orchestrator can prompt "I heard the category but not the amount."
  //
  // This must NOT swallow unrelated chatter ("hello", "what is the weather") that
  // happens to fuzzy-match a category (hello→Health, weather→Water). So we require
  // expense CONTEXT: either an explicit ADD verb is present, OR the leftover words
  // EXACTLY name a category. A bare ambiguous noun with neither is left UNKNOWN.
  if (!/\d/.test(text)) {
    const addVerbs = ['paid', 'spent', 'done', 'add', 'added', 'log', 'logged'];
    const fillers = [...addVerbs, 'for', 'on', 'to', 'in', 'rupees', 'rupee', 'rs'];
    const words = text.split(/\s+/).filter((w) => w && w !== '[unk]');
    const hasAddVerb = words.some((w) => addVerbs.includes(w));

    const leftover = words.filter((w) => !fillers.includes(w)).join(' ').trim();

    if (leftover) {
      const exact = categories.find((c) => c.name.toLowerCase() === leftover);
      // With an ADD verb present, allow fuzzy (the verb is the intent signal);
      // without one, only an exact category name counts.
      const matched = exact ?? (hasAddVerb ? matchCategory(leftover, categories) : null);
      if (matched) {
        return {
          ...base,
          action: 'ADD',
          amount: null, // signals "category understood, amount missing"
          period,
          category: matched.name,
          categoryId: matched.id,
        };
      }
    }
  }

  // ── UNKNOWN ────────────────────────────────────────────────────────────────
  return { ...base, period };
}
