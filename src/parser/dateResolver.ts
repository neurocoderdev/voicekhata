import {
  subDays,
  previousMonday,
  previousTuesday,
  previousWednesday,
  previousThursday,
  previousFriday,
  previousSaturday,
  previousSunday,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfWeek,
  endOfWeek,
  setDate,
  format,
  isAfter,
} from 'date-fns';

export type Period = 'this_month' | 'last_month' | 'this_week' | 'last_week';

export type DateResolveResult = {
  date: string;     // ISO 8601: "YYYY-MM-DD"
  period: Period | null;
  cleaned: string;  // original text with the matched temporal phrase removed
};

const WORD_TO_NUMBER: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  'twenty one': 21, 'twenty two': 22, 'twenty three': 23, 'twenty four': 24,
  'twenty five': 25, 'twenty six': 26, 'twenty seven': 27, 'twenty eight': 28,
  'twenty nine': 29, thirty: 30,
};

// Word ordinals for day-of-month phrases ("on the fifteenth"). Free-dictation
// STT spells these out, so digit-only matching ("on 15th") wasn't enough.
const WORD_ORDINALS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
  sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15,
  sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20,
  'twenty first': 21, 'twenty second': 22, 'twenty third': 23, 'twenty fourth': 24,
  'twenty fifth': 25, 'twenty sixth': 26, 'twenty seventh': 27, 'twenty eighth': 28,
  'twenty ninth': 29, thirtieth: 30, 'thirty first': 31,
};

function toIso(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

// Resolve a bare day-of-month to a concrete date: the given day in the current
// month, rolling back to the previous month if that day is still in the future
// (e.g. "on 25th" said on the 23rd means last month's 25th).
function dayOfMonthToDate(day: number, base: Date): Date {
  let candidate = setDate(base, day);
  if (isAfter(candidate, base)) {
    candidate = setDate(subMonths(base, 1), day);
  }
  return candidate;
}

function strip(text: string, phrase: string): string {
  return text.replace(phrase, '').replace(/\s{2,}/g, ' ').trim();
}

function stripRegex(text: string, re: RegExp): { stripped: string; match: RegExpMatchArray | null } {
  const match = text.match(re);
  if (!match) return { stripped: text, match: null };
  const stripped = text.replace(match[0], '').replace(/\s{2,}/g, ' ').trim();
  return { stripped, match };
}

export function resolveDate(text: string, now?: Date): DateResolveResult {
  const base = now ?? new Date();
  // Collapse runs of whitespace to single spaces and trim. Free-dictation STT
  // and natural typing produce irregular spacing ("last   month") that would
  // otherwise defeat the single-space \b...\b patterns below.
  const lower = text.toLowerCase().replace(/\s+/g, ' ').trim();

  // ── period expressions ───────────────────────────────────────────────────────
  // These carry BOTH a period (for QUERY range) AND a representative date inside
  // that period (for ADD — "spent 20 on gym last month" must NOT be dated today).
  //   this_month → today (already inside this month)
  //   last_month → same day-of-month one month back
  //   this_week  → today (already inside this week)
  //   last_week  → today − 7
  // The order matters: match "last week"/"last month" before the bare
  // "N weeks/months ago" and weekday branches below.

  if (/\bthis month\b/.test(lower)) {
    return { date: toIso(base), period: 'this_month', cleaned: strip(lower, 'this month') };
  }
  if (/\blast month\b/.test(lower)) {
    return { date: toIso(subMonths(base, 1)), period: 'last_month', cleaned: strip(lower, 'last month') };
  }
  if (/\bthis week\b/.test(lower)) {
    return { date: toIso(base), period: 'this_week', cleaned: strip(lower, 'this week') };
  }
  if (/\blast week\b/.test(lower)) {
    return { date: toIso(subDays(base, 7)), period: 'last_week', cleaned: strip(lower, 'last week') };
  }

  // ── relative days ──────────────────────────────────────────────────────────

  if (/\bday before yesterday\b/.test(lower)) {
    return { date: toIso(subDays(base, 2)), period: null, cleaned: strip(lower, 'day before yesterday') };
  }
  if (/\byesterday\b/.test(lower)) {
    return { date: toIso(subDays(base, 1)), period: null, cleaned: strip(lower, 'yesterday') };
  }
  if (/\btoday\b/.test(lower)) {
    return { date: toIso(base), period: null, cleaned: strip(lower, 'today') };
  }

  // ── "N days ago" / "N days back" ──────────────────────────────────────────
  {
    const re = /\b((?:twenty (?:one|two|three|four|five|six|seven|eight|nine)|(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty)|\d+)) days? (?:ago|back)\b/;
    const { stripped, match } = stripRegex(lower, re);
    if (match) {
      const raw = match[1];
      const n = isNaN(Number(raw)) ? (WORD_TO_NUMBER[raw] ?? 0) : Number(raw);
      return { date: toIso(subDays(base, n)), period: null, cleaned: stripped };
    }
  }

  // ── "last <weekday>" ──────────────────────────────────────────────────────
  {
    const re = /\blast (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/;
    const { stripped, match } = stripRegex(lower, re);
    if (match) {
      const dayFns: Record<string, (d: Date) => Date> = {
        monday: previousMonday,
        tuesday: previousTuesday,
        wednesday: previousWednesday,
        thursday: previousThursday,
        friday: previousFriday,
        saturday: previousSaturday,
        sunday: previousSunday,
      };
      return { date: toIso(dayFns[match[1]](base)), period: null, cleaned: stripped };
    }
  }

  // ── "N weeks ago" / "a week ago" ────────────────────────────────────────────
  {
    const re = /\b(?:(a|one|two|three|four|\d+) weeks? (?:ago|back)|a week (?:ago|back))\b/;
    const { stripped, match } = stripRegex(lower, re);
    if (match) {
      const raw = match[1];
      let n = 1;
      if (raw && raw !== 'a') {
        n = isNaN(Number(raw)) ? (WORD_TO_NUMBER[raw] ?? 1) : Number(raw);
      }
      return { date: toIso(subDays(base, n * 7)), period: null, cleaned: stripped };
    }
  }

  // ── "N months ago" / "a month ago" ──────────────────────────────────────────
  {
    const re = /\b(?:(a|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+) months? (?:ago|back)|a month (?:ago|back))\b/;
    const { stripped, match } = stripRegex(lower, re);
    if (match) {
      const raw = match[1];
      let n = 1;
      if (raw && raw !== 'a') {
        n = isNaN(Number(raw)) ? (WORD_TO_NUMBER[raw] ?? 1) : Number(raw);
      }
      // "a month ago" / "one month ago" also implies the last_month period so a
      // QUERY phrased that way returns the right range; multi-month-ago is a point
      // date only (no matching period type).
      const period: Period | null = n === 1 ? 'last_month' : null;
      return { date: toIso(subMonths(base, n)), period, cleaned: stripped };
    }
  }

  // ── "on [the] <ordinal>" — digit ("on 15th") OR word ("on the fifteenth") ──
  {
    // Digit ordinals first.
    const reDigit = /\bon(?: the)? (\d{1,2})(?:st|nd|rd|th)\b/;
    const digit = stripRegex(lower, reDigit);
    if (digit.match) {
      return { date: toIso(dayOfMonthToDate(parseInt(digit.match[1], 10), base)), period: null, cleaned: digit.stripped };
    }

    // Word ordinals — match the longest ordinal phrase ("twenty first" before "first").
    const ordinalWords = Object.keys(WORD_ORDINALS).sort((a, b) => b.length - a.length).join('|');
    const reWord = new RegExp(`\\bon(?: the)? (${ordinalWords})\\b`);
    const word = stripRegex(lower, reWord);
    if (word.match) {
      const day = WORD_ORDINALS[word.match[1]];
      return { date: toIso(dayOfMonthToDate(day, base)), period: null, cleaned: word.stripped };
    }
  }

  // ── "june 10" / "10 june" (month-name + day) ─────────────────────────────
  {
    const months: Record<string, number> = {
      january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
      july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
      jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    const monthNames = Object.keys(months).join('|');
    const re = new RegExp(`\\b(?:(\\d{1,2}) (${monthNames})|(${monthNames}) (\\d{1,2}))\\b`);
    const { stripped, match } = stripRegex(lower, re);
    if (match) {
      const dayStr = match[1] ?? match[4];
      const monthStr = match[2] ?? match[3];
      const day = parseInt(dayStr, 10);
      const month = months[monthStr];
      const d = new Date(base.getFullYear(), month, day);
      return { date: toIso(d), period: null, cleaned: stripped };
    }
  }

  // ── default: today ────────────────────────────────────────────────────────
  return { date: toIso(base), period: null, cleaned: lower };
}

// Helper re-exports used by intentParser and queries
export function todayIso(now?: Date): string {
  return toIso(now ?? new Date());
}

export function periodToRange(period: Period, now?: Date): { startDate: string; endDate: string } {
  const base = now ?? new Date();
  switch (period) {
    case 'this_month':
      return { startDate: toIso(startOfMonth(base)), endDate: toIso(base) };
    case 'last_month': {
      const prev = subMonths(base, 1);
      return { startDate: toIso(startOfMonth(prev)), endDate: toIso(endOfMonth(prev)) };
    }
    case 'this_week':
      return { startDate: toIso(startOfWeek(base, { weekStartsOn: 1 })), endDate: toIso(base) };
    case 'last_week': {
      const prevWeek = subDays(base, 7);
      return {
        startDate: toIso(startOfWeek(prevWeek, { weekStartsOn: 1 })),
        endDate: toIso(endOfWeek(prevWeek, { weekStartsOn: 1 })),
      };
    }
  }
}
