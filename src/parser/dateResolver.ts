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
  setDate,
  format,
  isAfter,
} from 'date-fns';

export type Period = 'this_month' | 'last_month' | 'this_week';

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

function toIso(d: Date): string {
  return format(d, 'yyyy-MM-dd');
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
  const lower = text.toLowerCase();

  // ── period queries ─────────────────────────────────────────────────────────

  if (/\bthis month\b/.test(lower)) {
    return { date: toIso(base), period: 'this_month', cleaned: strip(lower, 'this month') };
  }
  if (/\blast month\b/.test(lower)) {
    return { date: toIso(base), period: 'last_month', cleaned: strip(lower, 'last month') };
  }
  if (/\bthis week\b/.test(lower)) {
    return { date: toIso(base), period: 'this_week', cleaned: strip(lower, 'this week') };
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

  // ── "on [the] <ordinal>" e.g. "on 15th" / "on the 1st" ──────────────────
  {
    const re = /\bon(?: the)? (\d{1,2})(?:st|nd|rd|th)\b/;
    const { stripped, match } = stripRegex(lower, re);
    if (match) {
      const day = parseInt(match[1], 10);
      let candidate = setDate(base, day);
      if (isAfter(candidate, base)) {
        candidate = setDate(subMonths(base, 1), day);
      }
      return { date: toIso(candidate), period: null, cleaned: stripped };
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
  }
}
