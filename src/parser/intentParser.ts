import { resolveDate, Period } from './dateResolver';
import { matchCategory, Category } from './categoryMatcher';

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
  const text = cleaned.trim().toLowerCase();

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
          if (catName) {
            // Filter out common stop-words that bleed into category captures
            const stopWords = ['on', 'for', 'in', 'my', 'the', 'a', 'this', 'last', 'month', 'week'];
            const cleanCat = catName.trim().toLowerCase();
            if (!stopWords.includes(cleanCat)) {
              matched = matchCategory(cleanCat, categories);
            }
          }

          return {
            ...base,
            action: 'QUERY',
            period: period ?? 'this_month',
            category: matched?.name ?? catName ?? null,
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

    // Guard: category capture must not be a pure number or a keyword
    const stopWords = ['paid', 'spent', 'done', 'rupees', 'rs', 'add', 'log', 'on', 'for', 'to', 'in'];
    const catClean = catRaw.trim().toLowerCase();
    if (!catClean || stopWords.includes(catClean) || /^\d+$/.test(catClean)) continue;

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

  // ── UNKNOWN ────────────────────────────────────────────────────────────────
  return { ...base, period };
}
