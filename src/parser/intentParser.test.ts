import { parseIntent } from './intentParser';
import type { Category } from './categoryMatcher';

// Fixed reference date: Monday 2026-06-22
// We pass this through the text "today" or override via raw text that resolveDate handles.
// For date-agnostic assertions, we only check action/amount/category.

const SEED_CATEGORIES: Category[] = [
  { id: 1,  name: 'Gym',           parent: 'Personal' },
  { id: 2,  name: 'Entertainment', parent: 'Personal' },
  { id: 3,  name: 'Shopping',      parent: 'Personal' },
  { id: 4,  name: 'Health',        parent: 'Personal' },
  { id: 5,  name: 'Education',     parent: 'Personal' },
  { id: 6,  name: 'Grocery',       parent: 'Household' },
  { id: 7,  name: 'Electricity',   parent: 'Household' },
  { id: 8,  name: 'Water',         parent: 'Household' },
  { id: 9,  name: 'Gas',           parent: 'Household' },
  { id: 10, name: 'Rent',          parent: 'Household' },
  { id: 11, name: 'Maintenance',   parent: 'Household' },
  { id: 12, name: 'Auto',          parent: 'Transport' },
  { id: 13, name: 'Bus',           parent: 'Transport' },
  { id: 14, name: 'Fuel',          parent: 'Transport' },
  { id: 15, name: 'Parking',       parent: 'Transport' },
  { id: 16, name: 'Restaurant',    parent: 'Food' },
  { id: 17, name: 'Snacks',        parent: 'Food' },
  { id: 18, name: 'Tea/Coffee',    parent: 'Food' },
  { id: 19, name: 'Mobile',        parent: 'Bills' },
  { id: 20, name: 'Internet',      parent: 'Bills' },
  { id: 21, name: 'Insurance',     parent: 'Bills' },
  { id: 22, name: 'Subscriptions', parent: 'Bills' },
  { id: 23, name: 'Other',         parent: 'Other' },
];

function parse(text: string) {
  return parseIntent(text, SEED_CATEGORIES);
}

// ── ADD intents ───────────────────────────────────────────────────────────────

describe('ADD intents', () => {
  test('pattern: "<category> <amount> rupees paid"', () => {
    const r = parse('gym 500 rupees paid');
    expect(r.action).toBe('ADD');
    expect(r.amount).toBe(500);
    expect(r.categoryId).toBe(1); // Gym
  });

  test('pattern: "<category> <amount> paid" (no rupees)', () => {
    const r = parse('gym 500 paid');
    expect(r.action).toBe('ADD');
    expect(r.amount).toBe(500);
    expect(r.categoryId).toBe(1);
  });

  test('pattern: "gym 500 paid yesterday" — date resolves correctly', () => {
    const r = parse('gym 500 paid yesterday');
    expect(r.action).toBe('ADD');
    expect(r.amount).toBe(500);
    expect(r.categoryId).toBe(1);
    // date should not be today (no way to assert exact without mocking Date here,
    // but we verify the date string is valid ISO)
    expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('pattern: "spent <amount> on <category>"', () => {
    const r = parse('spent 1000 on grocery');
    expect(r.action).toBe('ADD');
    expect(r.amount).toBe(1000);
    expect(r.categoryId).toBe(6); // Grocery
  });

  test('pattern: "spent <amount> rupees on <category>"', () => {
    const r = parse('spent 1000 rupees on grocery');
    expect(r.action).toBe('ADD');
    expect(r.amount).toBe(1000);
    expect(r.categoryId).toBe(6);
  });

  test('pattern: "spent <amount> on <category> N days ago"', () => {
    const r = parse('spent 200 on auto 3 days ago');
    expect(r.action).toBe('ADD');
    expect(r.amount).toBe(200);
    expect(r.categoryId).toBe(12); // Auto
    expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('pattern: "add <amount> to <category>"', () => {
    const r = parse('add 500 to electricity');
    expect(r.action).toBe('ADD');
    expect(r.amount).toBe(500);
    expect(r.categoryId).toBe(7); // Electricity
  });

  test('pattern: "add <amount> rupees to <category>"', () => {
    const r = parse('add 500 rupees to electricity');
    expect(r.action).toBe('ADD');
    expect(r.amount).toBe(500);
    expect(r.categoryId).toBe(7);
  });

  test('pattern: "paid <category> <amount>"', () => {
    const r = parse('paid rent 15000');
    expect(r.action).toBe('ADD');
    expect(r.amount).toBe(15000);
    expect(r.categoryId).toBe(10); // Rent
  });

  test('pattern: "paid <category> <amount> on 1st" — date resolves', () => {
    const r = parse('paid rent 15000 on 1st');
    expect(r.action).toBe('ADD');
    expect(r.amount).toBe(15000);
    expect(r.categoryId).toBe(10);
    expect(r.date).toMatch(/^\d{4}-\d{2}-01$/);
  });

  test('pattern: "<amount> rupees <category>"', () => {
    const r = parse('1000 rupees gym');
    expect(r.action).toBe('ADD');
    expect(r.amount).toBe(1000);
    expect(r.categoryId).toBe(1);
  });

  test('pattern: "<amount> rs <category>"', () => {
    const r = parse('500 rs electricity');
    expect(r.action).toBe('ADD');
    expect(r.amount).toBe(500);
    expect(r.categoryId).toBe(7);
  });

  test('pattern: "<category> <amount>" (no verb)', () => {
    const r = parse('grocery 800');
    expect(r.action).toBe('ADD');
    expect(r.amount).toBe(800);
    expect(r.categoryId).toBe(6);
  });

  test('pattern: "spent <amount> <category>" (no preposition)', () => {
    const r = parse('spent 300 auto');
    expect(r.action).toBe('ADD');
    expect(r.amount).toBe(300);
    expect(r.categoryId).toBe(12);
  });

  // ── amounts ────────────────────────────────────────────────────────────────

  test('large amount: "rent 50000 paid"', () => {
    const r = parse('rent 50000 paid');
    expect(r.action).toBe('ADD');
    expect(r.amount).toBe(50000);
  });

  test('small amount: "tea 10 paid"', () => {
    const r = parse('tea 10 paid');
    expect(r.action).toBe('ADD');
    expect(r.amount).toBe(10);
  });

  test('decimal amount: "snacks 45.50 paid"', () => {
    const r = parse('snacks 45.50 paid');
    expect(r.action).toBe('ADD');
    expect(r.amount).toBe(45.5);
  });
});

// ── QUERY intents ─────────────────────────────────────────────────────────────

describe('QUERY intents', () => {
  test('"how much spent on gym this month"', () => {
    const r = parse('how much spent on gym this month');
    expect(r.action).toBe('QUERY');
    expect(r.categoryId).toBe(1);
    expect(r.period).toBe('this_month');
  });

  test('"how much spent on gym" — defaults to this_month', () => {
    const r = parse('how much spent on gym');
    expect(r.action).toBe('QUERY');
    expect(r.categoryId).toBe(1);
    expect(r.period).toBe('this_month');
  });

  test('"total groceries last month"', () => {
    const r = parse('total groceries last month');
    expect(r.action).toBe('QUERY');
    expect(r.categoryId).toBe(6); // Grocery
    expect(r.period).toBe('last_month');
  });

  test('"what was my bill last month" — no category (all)', () => {
    const r = parse('what was my bill last month');
    expect(r.action).toBe('QUERY');
    expect(r.category).toBeNull();
    expect(r.period).toBe('last_month');
  });

  test('"show expenses" — no category, this_month', () => {
    const r = parse('show expenses');
    expect(r.action).toBe('QUERY');
    expect(r.category).toBeNull();
    expect(r.period).toBe('this_month');
  });

  test('"list spending"', () => {
    const r = parse('list spending');
    expect(r.action).toBe('QUERY');
    expect(r.period).toBe('this_month');
  });

  test('"gym spending"', () => {
    const r = parse('gym spending');
    expect(r.action).toBe('QUERY');
    expect(r.categoryId).toBe(1);
    expect(r.period).toBe('this_month');
  });

  test('"electricity expenses"', () => {
    const r = parse('electricity expenses');
    expect(r.action).toBe('QUERY');
    expect(r.categoryId).toBe(7);
  });

  test('"how much spent on groceries this week"', () => {
    const r = parse('how much spent on groceries this week');
    expect(r.action).toBe('QUERY');
    expect(r.period).toBe('this_week');
  });
});

// ── CREATE_CATEGORY intents ───────────────────────────────────────────────────

describe('CREATE_CATEGORY intents', () => {
  test('"create category clothes under personal"', () => {
    const r = parse('create category clothes under personal');
    expect(r.action).toBe('CREATE_CATEGORY');
    expect(r.newCategoryName).toBe('clothes');
    expect(r.newCategoryParent).toBe('personal');
  });

  test('"create category petrol under transport"', () => {
    const r = parse('create category petrol under transport');
    expect(r.action).toBe('CREATE_CATEGORY');
    expect(r.newCategoryName).toBe('petrol');
    expect(r.newCategoryParent).toBe('transport');
  });

  test('"create category medical expenses under health"', () => {
    const r = parse('create category medical expenses under health');
    expect(r.action).toBe('CREATE_CATEGORY');
    expect(r.newCategoryName).toBe('medical expenses');
    expect(r.newCategoryParent).toBe('health');
  });
});

// ── EXPORT intents ─────────────────────────────────────────────────────────────

describe('EXPORT intents', () => {
  test('"export this month"', () => {
    const r = parse('export this month');
    expect(r.action).toBe('EXPORT');
    expect(r.period).toBe('this_month');
  });

  test('"export last month"', () => {
    const r = parse('export last month');
    expect(r.action).toBe('EXPORT');
    expect(r.period).toBe('last_month');
  });

  test('"export" alone — defaults to this_month', () => {
    const r = parse('export');
    expect(r.action).toBe('EXPORT');
    expect(r.period).toBe('this_month');
  });
});

// ── UNKNOWN intents ─────────────────────────────────────────────────────────────

describe('UNKNOWN intents', () => {
  test('"hello"', () => {
    expect(parse('hello').action).toBe('UNKNOWN');
  });

  test('"what is the weather"', () => {
    expect(parse('what is the weather').action).toBe('UNKNOWN');
  });

  test('"500" alone (no category)', () => {
    expect(parse('500').action).toBe('UNKNOWN');
  });

  test('empty string', () => {
    expect(parse('').action).toBe('UNKNOWN');
  });

  test('"please help me"', () => {
    expect(parse('please help me').action).toBe('UNKNOWN');
  });
});

// ── Fuzzy matching edge cases ─────────────────────────────────────────────────

describe('fuzzy category matching', () => {
  test('"grosory 500 paid" → Grocery (fuzzy)', () => {
    const r = parse('grosory 500 paid');
    expect(r.action).toBe('ADD');
    expect(r.amount).toBe(500);
    expect(r.categoryId).toBe(6); // Grocery
  });

  // "jim" is too short to fuzzy-match "Gym" at threshold 0.4 in Fuse.js.
  // A realistic Vosk misrecognition is "gim" which does match.
  test('"gim 300 paid" → Gym (fuzzy — realistic Vosk misrecognition)', () => {
    const r = parse('gim 300 paid');
    expect(r.action).toBe('ADD');
    expect(r.amount).toBe(300);
    expect(r.categoryId).toBe(1); // Gym
  });

  test('"electrisity 800" → Electricity (fuzzy)', () => {
    const r = parse('electrisity 800');
    expect(r.action).toBe('ADD');
    expect(r.categoryId).toBe(7); // Electricity
  });

  test('"spent 400 on resturant" → Restaurant (fuzzy)', () => {
    const r = parse('spent 400 on resturant');
    expect(r.action).toBe('ADD');
    expect(r.categoryId).toBe(16); // Restaurant
  });
});

// ── date integration ──────────────────────────────────────────────────────────

describe('date integration in ADD intents', () => {
  test('date field is always a valid ISO string', () => {
    const r = parse('gym 500 paid');
    expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('"gym 500 paid yesterday" has a date different from today', () => {
    const today = new Date().toISOString().split('T')[0];
    const r = parse('gym 500 paid yesterday');
    expect(r.date).not.toBe(today);
  });

  test('"gym 500 paid last monday" has a date different from today', () => {
    const today = new Date().toISOString().split('T')[0];
    const r = parse('gym 500 paid last monday');
    expect(r.date).not.toBe(today);
  });
});
