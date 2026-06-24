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

// Lowercase names of the seed categories — used by the Categories screen to
// distinguish user-created categories (deletable) from seed ones (protected).
export const SEED_CATEGORY_NAMES: Set<string> = new Set(
  SEED_CATEGORIES.map((c) => c.name.toLowerCase())
);

// Spoken-word → canonical seed-category-name synonyms. Checked by the category
// matcher BEFORE fuzzy matching. Two jobs:
//   1. Real synonyms the user might say ("petrol"→Fuel, "veggies"→Grocery).
//   2. Common STT phonetic misrecognitions that fuzzy matching can't bridge by
//      edit distance ("jim"/"jeem"→Gym, "groser"→Grocery).
// Keys are lowercase. Values MUST be an exact seed category `name`.
export const CATEGORY_SYNONYMS: Record<string, string> = {
  // ── Gym ──
  jim: 'Gym', jym: 'Gym', jeem: 'Gym', gymnasium: 'Gym', workout: 'Gym',
  fitness: 'Gym', exercise: 'Gym', yoga: 'Gym', zumba: 'Gym', crossfit: 'Gym',
  // ── Grocery ──
  groceries: 'Grocery', grocer: 'Grocery', groser: 'Grocery', veggies: 'Grocery',
  vegetables: 'Grocery', vegetable: 'Grocery', kirana: 'Grocery', sabzi: 'Grocery',
  fruits: 'Grocery', fruit: 'Grocery', milk: 'Grocery', supermarket: 'Grocery',
  mart: 'Grocery', provisions: 'Grocery', rations: 'Grocery',
  // ── Fuel (note: "gas" maps to Gas, the cooking-gas category, not Fuel) ──
  petrol: 'Fuel', diesel: 'Fuel', gasoline: 'Fuel', cng: 'Fuel', refuel: 'Fuel',
  // ── Gas (cooking) ──
  cylinder: 'Gas', lpg: 'Gas', gas: 'Gas',
  // ── Transport / Auto ──
  cab: 'Auto', taxi: 'Auto', rickshaw: 'Auto', ola: 'Auto', uber: 'Auto',
  autorickshaw: 'Auto', rapido: 'Auto', toto: 'Auto', share: 'Auto',
  // ── Bus ──
  buses: 'Bus', metro: 'Bus', train: 'Bus', local: 'Bus', ticket: 'Bus',
  // ── Parking ──
  parkings: 'Parking', toll: 'Parking', valet: 'Parking',
  // ── Restaurant ──
  restaurants: 'Restaurant', hotel: 'Restaurant', dining: 'Restaurant',
  dinner: 'Restaurant', lunch: 'Restaurant', breakfast: 'Restaurant',
  food: 'Restaurant', meal: 'Restaurant', swiggy: 'Restaurant', zomato: 'Restaurant',
  // ── Snacks ──
  snack: 'Snacks', chips: 'Snacks', biscuits: 'Snacks', namkeen: 'Snacks',
  // ── Tea/Coffee ──
  tea: 'Tea/Coffee', coffee: 'Tea/Coffee', chai: 'Tea/Coffee', cafe: 'Tea/Coffee',
  beverage: 'Tea/Coffee', beverages: 'Tea/Coffee', juice: 'Tea/Coffee',
  // ── Mobile ──
  recharge: 'Mobile', phone: 'Mobile', mobiles: 'Mobile', sim: 'Mobile',
  airtime: 'Mobile', talktime: 'Mobile', topup: 'Mobile',
  // ── Internet ──
  wifi: 'Internet', broadband: 'Internet', fiber: 'Internet', data: 'Internet',
  net: 'Internet',
  // ── Insurance ──
  insurances: 'Insurance', policy: 'Insurance', premium: 'Insurance', lic: 'Insurance',
  // ── Subscriptions ──
  subscription: 'Subscriptions', netflix: 'Subscriptions', prime: 'Subscriptions',
  spotify: 'Subscriptions', hotstar: 'Subscriptions', youtube: 'Subscriptions',
  membership: 'Subscriptions',
  // ── Electricity ──
  electric: 'Electricity', electrical: 'Electricity', current: 'Electricity',
  power: 'Electricity', bijli: 'Electricity', light: 'Electricity',
  // ── Water ──
  waters: 'Water', tanker: 'Water', pani: 'Water',
  // ── Rent ──
  rents: 'Rent', lease: 'Rent', emi: 'Rent', loan: 'Rent', mortgage: 'Rent',
  // ── Maintenance ──
  repair: 'Maintenance', repairs: 'Maintenance', servicing: 'Maintenance',
  plumber: 'Maintenance', electrician: 'Maintenance', cleaning: 'Maintenance',
  // ── Health ──
  medicine: 'Health', medicines: 'Health', medical: 'Health', doctor: 'Health',
  hospital: 'Health', pharmacy: 'Health', clinic: 'Health', dentist: 'Health',
  checkup: 'Health', tablets: 'Health',
  // ── Entertainment ──
  movie: 'Entertainment', movies: 'Entertainment', games: 'Entertainment',
  game: 'Entertainment', cinema: 'Entertainment', concert: 'Entertainment',
  outing: 'Entertainment', party: 'Entertainment',
  // ── Shopping ──
  clothes: 'Shopping', clothing: 'Shopping', shoes: 'Shopping', dress: 'Shopping',
  shirt: 'Shopping', amazon: 'Shopping', flipkart: 'Shopping', myntra: 'Shopping',
  gadget: 'Shopping', electronics: 'Shopping',
  // ── Education ──
  school: 'Education', college: 'Education', tuition: 'Education', books: 'Education',
  book: 'Education', course: 'Education', fees: 'Education', stationery: 'Education',
  exam: 'Education',
};

// Grammar passed to Vosk's grammar-constrained recognizer. This is NOT a soft
// "hint" — Vosk builds a restricted decoding graph from EXACTLY these words and
// can only output words on this list (plus "[unk]" for anything else). That is a
// deliberate trade-off: rock-solid accuracy on expense commands at the cost of
// general dictation. Because of this, the grammar MUST be a superset of every
// word the parser (intentParser.ts + dateResolver.ts + category names) can
// understand — any command word missing here can never reach the parser.
// Keep lowercase — Vosk normalises to lowercase before matching.
// The fixed (non-category) vocabulary. Category words are appended
// programmatically below so the grammar can never drift out of sync with the
// seed categories or the synonym map.
const GRAMMAR_FIXED: string[] = [
  // ── Action verbs ──
  'paid', 'pay', 'spent', 'spend', 'add', 'adding', 'added', 'log', 'logged',
  'create', 'created', 'put', 'note',
  // ── Prepositions / connectors ──
  'on', 'for', 'to', 'in', 'at', 'of', 'by', 'under', 'and', 'the', 'a', 'my',
  // ── Currency ──
  'rupees', 'rupee', 'rs', 'lakh', 'lakhs', 'crore', 'crores',
  // ── Numbers: digits (the model may emit digits directly) ──
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  // ── Numbers: ones ──
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  // ── Numbers: teens ──
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
  'sixteen', 'seventeen', 'eighteen', 'nineteen',
  // ── Numbers: tens ──
  'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety',
  // ── Numbers: scales ──
  'hundred', 'thousand',
  // ── Ordinals (word) for "on the fifteenth" ──
  'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth',
  'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth',
  'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth',
  'thirtieth',
  // ── Query words ──
  'how', 'much', 'what', 'was', 'were', 'is', 'my', 'me', 'bill', 'bills',
  'show', 'total', 'spending', 'expense', 'expenses', 'transaction', 'transactions',
  'list', 'export', 'did', 'i', 'have',
  // ── Time periods / relative dates ──
  'today', 'yesterday', 'tomorrow', 'month', 'months', 'week', 'weeks',
  'year', 'years', 'last', 'this', 'next', 'past', 'day', 'days', 'ago', 'back',
  // ── Weekdays ──
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  // ── Month names ──
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
  // ── Category structure words ──
  'category', 'categories', 'personal', 'household', 'transport', 'food', 'bills', 'other',
];

// Related / contextual vocabulary that is NOT a category and NOT core syntax, but
// is commonly spoken AROUND expense commands. Including these in the grammar lets
// Vosk decode full natural sentences accurately instead of dropping the unknown
// words (which degrades recognition of the words we DO care about). The parser
// ignores most of these or treats them as filler; cleanCategoryCapture() strips
// any that drift into a capture. Goal: ~1.5–2x the prior grammar size.
const GRAMMAR_RELATED: string[] = [
  // ── More action / intent verbs and their forms ──
  'pays', 'paying', 'spends', 'spending', 'spent', 'bought', 'buy', 'buying',
  'purchase', 'purchased', 'cost', 'costs', 'costed', 'gave', 'give', 'given',
  'record', 'recorded', 'enter', 'entered', 'remove', 'delete', 'deleted',
  'update', 'updated', 'set', 'check', 'tell', 'find', 'get', 'got', 'used',
  'spend', 'expensed', 'billed', 'charge', 'charged',
  // ── More query / question words ──
  'where', 'when', 'which', 'why', 'who', 'can', 'could', 'should',
  'do', 'does', 'done', 'are', 'be',
  'overall', 'summary', 'report', 'breakdown', 'details', 'history',
  'recent', 'amount', 'amounts', 'money', 'cash', 'balance',
  'average', 'highest', 'lowest', 'most', 'least', 'all', 'any',
  // ── Connectors / fillers people actually say ──
  'please', 'just', 'about', 'around', 'roughly', 'approximately', 'only',
  'also', 'then', 'these', 'those', 'it', 'our', 'your', 'from', 'with',
  'per', 'each', 'every',
  // ── Time: more granular & natural ──
  'morning', 'afternoon', 'evening', 'night', 'tonight', 'noon', 'midnight',
  'now', 'recently', 'earlier', 'before', 'after', 'during', 'since', 'until',
  'weekend', 'weekday', 'fortnight', 'quarter', 'half',
  'twenty-first', 'twenty-fifth', 'thirty-first',
  // ── Month short forms (the model may emit these) ──
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
  // ── Numbers: more scales & fillers ──
  'million', 'billion', 'dozen', 'couple', 'few', 'several', 'point', 'rupaye',
  'paisa', 'paise', 'bucks', 'grand',
  // ── Currency / money words ──
  'amount', 'price', 'fee', 'fees', 'charges', 'spent', 'budget', 'limit',
];

// Build the category-word portion from seed names (split slash-compound names
// like "Tea/Coffee" into "tea" + "coffee") and every synonym key. This is what
// keeps the grammar a guaranteed superset of what the matcher understands.
function buildGrammar(): string[] {
  const words = new Set<string>([
    ...GRAMMAR_FIXED.map((w) => w.toLowerCase()),
    ...GRAMMAR_RELATED.map((w) => w.toLowerCase()),
  ]);

  for (const cat of SEED_CATEGORIES) {
    for (const part of cat.name.toLowerCase().split(/[^a-z]+/)) {
      if (part) words.add(part);
    }
  }
  for (const key of Object.keys(CATEGORY_SYNONYMS)) {
    for (const part of key.toLowerCase().split(/[^a-z]+/)) {
      if (part) words.add(part);
    }
  }

  // "[unk]" is CRITICAL: without it Vosk force-fits every out-of-vocabulary word
  // to the nearest grammar word; with it, genuinely unknown speech comes through
  // as [unk] (which the parser strips) instead of corrupting the command.
  words.add('[unk]');
  return Array.from(words);
}

export const VOSK_GRAMMAR: string[] = buildGrammar();

export const CATEGORY_PARENTS = [
  'Personal',
  'Household',
  'Transport',
  'Food',
  'Bills',
  'Other',
] as const;

// Consistent color per parent group — used for the dot on expense cards and the
// category chips, so a given group always reads the same color across screens.
const PARENT_COLORS: Record<string, string> = {
  Personal: '#7c83fd',
  Household: '#4ade80',
  Transport: '#f0a030',
  Food: '#e05260',
  Bills: '#38bdf8',
  Other: '#a78bfa',
};

export function parentColor(parent: string | null | undefined): string {
  if (!parent) return '#8888aa';
  return PARENT_COLORS[parent] ?? '#8888aa';
}
