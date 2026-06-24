// Spoken-number normalization.
//
// WHY THIS EXISTS: Vosk runs in grammar-constrained mode (see VOSK_GRAMMAR in
// constants.ts). The grammar contains number WORDS ("five", "hundred",
// "thousand", "lakh"...) and NO digit tokens — Vosk can only output words on the
// list. So on-device a user saying "gym five hundred rupees paid" produces the
// literal text "gym five hundred rupees paid", never "gym 500 ...". The intent
// regexes match digits, so without this step every spoken command falls through
// to UNKNOWN.
//
// This converts runs of number words into a digit string, in place, so the
// existing digit-based regexes work unchanged. It is a pure function and runs on
// the date-stripped "cleaned" text, so it never collides with date phrases
// (those are already removed by dateResolver before the parser sees the text).

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

// Scale words. "hundred" multiplies the current chunk; thousand/lakh/crore close
// off a chunk and add it to the running total (Indian numbering supported).
const SCALES: Record<string, number> = {
  hundred: 100,
  thousand: 1000,
  lakh: 100000,
  lakhs: 100000,
  crore: 10000000,
  crores: 10000000,
};

// Filler word allowed *inside* a number phrase: "one hundred and fifty".
const NUMBER_FILLER = new Set(['and']);

function isNumberWord(tok: string): boolean {
  return (
    tok in UNITS ||
    tok in TENS ||
    tok in SCALES ||
    /^\d+$/.test(tok)
  );
}

// Convert a run of number tokens (already known to be number words/digits, plus
// optional internal "and") into a single integer.
function wordsToNumber(tokens: string[]): number {
  let total = 0;   // accumulated value across thousand/lakh/crore groups
  let current = 0; // value being built within the current group

  for (const tok of tokens) {
    if (NUMBER_FILLER.has(tok)) continue;

    if (/^\d+$/.test(tok)) {
      current += parseInt(tok, 10);
      continue;
    }
    if (tok in UNITS) {
      current += UNITS[tok];
      continue;
    }
    if (tok in TENS) {
      current += TENS[tok];
      continue;
    }
    if (tok === 'hundred') {
      // "five hundred" → current(5) * 100. Bare "hundred" → 100.
      current = (current === 0 ? 1 : current) * 100;
      continue;
    }
    // thousand / lakh / crore — close the current group.
    const scale = SCALES[tok];
    current = (current === 0 ? 1 : current) * scale;
    total += current;
    current = 0;
  }

  return total + current;
}

// Replace every maximal run of number words in `text` with its digit value.
// "gym five hundred rupees paid" → "gym 500 rupees paid".
// A trailing/internal "and" is only absorbed when flanked by number words, so
// "tea and snacks" is untouched.
export function normalizeNumberWords(text: string): string {
  const tokens = text.split(/\s+/);
  const out: string[] = [];
  let i = 0;

  while (i < tokens.length) {
    const tok = tokens[i];

    if (isNumberWord(tok)) {
      // Greedily collect the number run. "and" is only kept if a number word
      // follows it; otherwise the run stops before the "and".
      const run: string[] = [];
      let j = i;
      while (j < tokens.length) {
        const t = tokens[j];
        if (isNumberWord(t)) {
          run.push(t);
          j++;
        } else if (NUMBER_FILLER.has(t) && j + 1 < tokens.length && isNumberWord(tokens[j + 1])) {
          run.push(t);
          j++;
        } else {
          break;
        }
      }
      out.push(String(wordsToNumber(run)));
      i = j;
    } else {
      out.push(tok);
      i++;
    }
  }

  return out.join(' ');
}
