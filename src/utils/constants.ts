export type SeedCategory = {
  name: string;
  parent: string;
};

export const SEED_CATEGORIES: SeedCategory[] = [
  // Personal
  { name: 'Gym', parent: 'Personal' },
  { name: 'Entertainment', parent: 'Personal' },
  { name: 'Shopping', parent: 'Personal' },
  { name: 'Health', parent: 'Personal' },
  { name: 'Education', parent: 'Personal' },
  // Household
  { name: 'Grocery', parent: 'Household' },
  { name: 'Electricity', parent: 'Household' },
  { name: 'Water', parent: 'Household' },
  { name: 'Gas', parent: 'Household' },
  { name: 'Rent', parent: 'Household' },
  { name: 'Maintenance', parent: 'Household' },
  // Transport
  { name: 'Auto', parent: 'Transport' },
  { name: 'Bus', parent: 'Transport' },
  { name: 'Fuel', parent: 'Transport' },
  { name: 'Parking', parent: 'Transport' },
  // Food
  { name: 'Restaurant', parent: 'Food' },
  { name: 'Snacks', parent: 'Food' },
  { name: 'Tea/Coffee', parent: 'Food' },
  // Bills
  { name: 'Mobile', parent: 'Bills' },
  { name: 'Internet', parent: 'Bills' },
  { name: 'Insurance', parent: 'Bills' },
  { name: 'Subscriptions', parent: 'Bills' },
  // Other
  { name: 'Other', parent: 'Other' },
];

export const DB_NAME = 'voicekhata.db';

// Grammar passed to Vosk's grammar-constrained recognizer. This is NOT a soft
// "hint" — Vosk builds a restricted decoding graph from EXACTLY these words and
// can only output words on this list (plus "[unk]" for anything else). That is a
// deliberate trade-off: rock-solid accuracy on expense commands at the cost of
// general dictation. Because of this, the grammar MUST be a superset of every
// word the parser (intentParser.ts + dateResolver.ts + category names) can
// understand — any command word missing here can never reach the parser.
// Keep lowercase — Vosk normalises to lowercase before matching.
export const VOSK_GRAMMAR: string[] = [
  // ── Action verbs ──
  'paid', 'spent', 'spend', 'add', 'added', 'log', 'logged', 'create', 'created',
  // ── Prepositions / connectors used in commands ──
  'on', 'for', 'to', 'in', 'at', 'of', 'by', 'under', 'and',
  // ── Currency ──
  'rupees', 'rupee', 'rs', 'lakh', 'lakhs', 'crore', 'crores',
  // ── Numbers: ones ──
  'zero', 'one', 'two', 'three', 'four', 'five',
  'six', 'seven', 'eight', 'nine', 'ten',
  // ── Numbers: teens (parser supports these — were missing before) ──
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
  'sixteen', 'seventeen', 'eighteen', 'nineteen',
  // ── Numbers: tens ──
  'twenty', 'thirty', 'forty', 'fifty',
  'sixty', 'seventy', 'eighty', 'ninety',
  // ── Numbers: scales ──
  'hundred', 'thousand',
  // ── Query words ──
  'how', 'much', 'what', 'was', 'were', 'my', 'bill', 'bills', 'show', 'total',
  'expense', 'expenses', 'spending', 'list', 'export',
  // ── Time periods / relative dates ──
  'today', 'yesterday', 'month', 'week', 'last', 'this', 'past',
  'day', 'days', 'ago', 'back',
  // ── Weekdays ──
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  // ── Month names (parser resolves "june 10" etc — were missing before) ──
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
  // ── Category names + common spoken synonyms ──
  'gym', 'entertainment', 'shopping', 'health', 'education',
  'grocery', 'groceries', 'electricity', 'water', 'gas', 'rent', 'maintenance',
  'auto', 'bus', 'fuel', 'petrol', 'parking',
  'restaurant', 'snacks', 'tea', 'coffee',
  'mobile', 'internet', 'insurance', 'subscription', 'subscriptions',
  'clothes', 'clothing',
  'other', 'category', 'personal', 'household', 'transport', 'food', 'bills',
  // ── Allow-unknown fallback — CRITICAL ──
  // Without "[unk]" Vosk refuses to output anything it can't map to the list,
  // which destroys accuracy and the fuzzy-category fallback. With it, out-of-
  // vocabulary words come through as [unk] instead of being force-fit to a
  // wrong grammar word.
  '[unk]',
];

export const CATEGORY_PARENTS = [
  'Personal',
  'Household',
  'Transport',
  'Food',
  'Bills',
  'Other',
] as const;
