import { resolveDate } from './dateResolver';

// Fixed reference: Monday 2026-06-22
const NOW = new Date(2026, 5, 22); // month is 0-indexed → June

describe('dateResolver', () => {
  // ── no date mention ─────────────────────────────────────────────────────────
  test('no temporal expression → today', () => {
    const { date, period, cleaned } = resolveDate('gym 500 paid', NOW);
    expect(date).toBe('2026-06-22');
    expect(period).toBeNull();
    expect(cleaned).toBe('gym 500 paid');
  });

  // ── "today" ─────────────────────────────────────────────────────────────────
  test('"today" → today', () => {
    const { date, period, cleaned } = resolveDate('gym 500 paid today', NOW);
    expect(date).toBe('2026-06-22');
    expect(period).toBeNull();
    expect(cleaned).not.toContain('today');
  });

  // ── "yesterday" ─────────────────────────────────────────────────────────────
  test('"yesterday" → today - 1', () => {
    const { date, period } = resolveDate('grocery 800 paid yesterday', NOW);
    expect(date).toBe('2026-06-21');
    expect(period).toBeNull();
  });

  test('"yesterday" is stripped from cleaned text', () => {
    const { cleaned } = resolveDate('gym 500 yesterday', NOW);
    expect(cleaned).not.toContain('yesterday');
  });

  // ── "day before yesterday" ──────────────────────────────────────────────────
  test('"day before yesterday" → today - 2', () => {
    const { date } = resolveDate('bus 30 rs day before yesterday', NOW);
    expect(date).toBe('2026-06-20');
  });

  test('"day before yesterday" stripped from cleaned', () => {
    const { cleaned } = resolveDate('bus 30 rs day before yesterday', NOW);
    expect(cleaned).not.toContain('day before yesterday');
  });

  // ── "N days ago" ────────────────────────────────────────────────────────────
  test('"3 days ago" → today - 3', () => {
    const { date } = resolveDate('spent 200 on auto 3 days ago', NOW);
    expect(date).toBe('2026-06-19');
  });

  test('"5 days back" → today - 5', () => {
    const { date } = resolveDate('electricity 500 5 days back', NOW);
    expect(date).toBe('2026-06-17');
  });

  test('"1 day ago" → today - 1', () => {
    const { date } = resolveDate('tea 20 1 day ago', NOW);
    expect(date).toBe('2026-06-21');
  });

  // ── word numbers ─────────────────────────────────────────────────────────────
  test('"three days ago" → today - 3 (word number)', () => {
    const { date } = resolveDate('auto 300 three days ago', NOW);
    expect(date).toBe('2026-06-19');
  });

  test('"seven days ago" → today - 7', () => {
    const { date } = resolveDate('gym 500 seven days ago', NOW);
    expect(date).toBe('2026-06-15');
  });

  test('"ten days back" → today - 10', () => {
    const { date } = resolveDate('rent 15000 ten days back', NOW);
    expect(date).toBe('2026-06-12');
  });

  // ── "last <weekday>" ─────────────────────────────────────────────────────────
  // NOW = Monday 2026-06-22, so "last monday" = 2026-06-15
  test('"last monday" resolves to previous Monday', () => {
    const { date } = resolveDate('gym 500 last monday', NOW);
    expect(date).toBe('2026-06-15');
  });

  test('"last friday" resolves to previous Friday', () => {
    const { date } = resolveDate('snacks 100 last friday', NOW);
    expect(date).toBe('2026-06-19');
  });

  test('"last sunday" resolves to previous Sunday', () => {
    const { date } = resolveDate('restaurant 800 last sunday', NOW);
    expect(date).toBe('2026-06-21');
  });

  test('"last weekday" phrase stripped from cleaned', () => {
    const { cleaned } = resolveDate('gym 500 last monday', NOW);
    expect(cleaned).not.toContain('last monday');
  });

  // ── "on <ordinal>" ───────────────────────────────────────────────────────────
  // NOW = 2026-06-22, so "on 15th" → 2026-06-15 (current month, in the past)
  test('"on 15th" → 15th of current month when past', () => {
    const { date } = resolveDate('rent 15000 on 15th', NOW);
    expect(date).toBe('2026-06-15');
  });

  test('"on the 1st" → 1st of current month when past', () => {
    const { date } = resolveDate('electricity 800 on the 1st', NOW);
    expect(date).toBe('2026-06-01');
  });

  // "on 25th" when NOW = 22nd → future in current month → use previous month
  test('"on 25th" when future → resolves to previous month', () => {
    const { date } = resolveDate('gym 500 on 25th', NOW);
    expect(date).toBe('2026-05-25');
  });

  test('"on 22nd" (same as today) → today', () => {
    const { date } = resolveDate('grocery 200 on 22nd', NOW);
    expect(date).toBe('2026-06-22');
  });

  test('"on ordinal" stripped from cleaned', () => {
    const { cleaned } = resolveDate('rent 15000 on 15th', NOW);
    expect(cleaned).not.toContain('on 15th');
  });

  // ── period queries ───────────────────────────────────────────────────────────
  test('"this month" → period: this_month, date: today', () => {
    const { date, period } = resolveDate('how much spent on gym this month', NOW);
    expect(date).toBe('2026-06-22');
    expect(period).toBe('this_month');
  });

  test('"last month" → period: last_month, date: SAME DAY last month (for ADD)', () => {
    // The date must land INSIDE last month so "spent 20 on gym last month" is not
    // dated today. NOW is 2026-06-22 → last-month date is 2026-05-22.
    const { date, period } = resolveDate('total groceries last month', NOW);
    expect(date).toBe('2026-05-22');
    expect(period).toBe('last_month');
  });

  test('"this week" → period: this_week, date: today', () => {
    const { date, period } = resolveDate('show expenses this week', NOW);
    expect(date).toBe('2026-06-22');
    expect(period).toBe('this_week');
  });

  test('"last week" → period: last_week, date: today − 7', () => {
    const { date, period } = resolveDate('show expenses last week', NOW);
    expect(date).toBe('2026-06-15');
    expect(period).toBe('last_week');
  });

  test('"a month ago" → last_month period, date one month back', () => {
    const { date, period } = resolveDate('gym 500 paid a month ago', NOW);
    expect(date).toBe('2026-05-22');
    expect(period).toBe('last_month');
  });

  test('"two months ago" → date two months back, no period', () => {
    const { date, period } = resolveDate('gym 500 two months ago', NOW);
    expect(date).toBe('2026-04-22');
    expect(period).toBeNull();
  });

  test('period phrase stripped from cleaned', () => {
    const { cleaned } = resolveDate('how much spent on gym this month', NOW);
    expect(cleaned).not.toContain('this month');
  });

  // ── "june 10" / "10 june" ────────────────────────────────────────────────────
  test('"june 10" → 2026-06-10', () => {
    const { date } = resolveDate('gym 500 june 10', NOW);
    expect(date).toBe('2026-06-10');
  });

  test('"10 june" → 2026-06-10', () => {
    const { date } = resolveDate('grocery 800 10 june', NOW);
    expect(date).toBe('2026-06-10');
  });

  // ── word ordinals (free-dictation produces these) ───────────────────────────
  test('"on the fifteenth" → 15th of current month', () => {
    const { date, cleaned } = resolveDate('gym 500 paid on the fifteenth', NOW);
    expect(date).toBe('2026-06-15');
    expect(cleaned).not.toContain('fifteenth');
  });

  test('"on fifteenth" (no "the") → 15th', () => {
    const { date } = resolveDate('gym 500 on fifteenth', NOW);
    expect(date).toBe('2026-06-15');
  });

  test('"on the twenty first" → 21st (compound word ordinal)', () => {
    const { date } = resolveDate('rent 15000 on the twenty first', NOW);
    expect(date).toBe('2026-06-21');
  });

  test('"on the twenty fifth" (future this month) → previous month 25th', () => {
    // base is the 22nd, so the 25th would be future → roll to May.
    const { date } = resolveDate('gym 500 on the twenty fifth', NOW);
    expect(date).toBe('2026-05-25');
  });

  // ── weeks ────────────────────────────────────────────────────────────────────
  test('"a week ago" → today − 7', () => {
    const { date, cleaned } = resolveDate('gym 500 paid a week ago', NOW);
    expect(date).toBe('2026-06-15');
    expect(cleaned).not.toContain('week');
  });

  test('"two weeks ago" → today − 14', () => {
    const { date } = resolveDate('gym 500 paid two weeks ago', NOW);
    expect(date).toBe('2026-06-08');
  });

  // ── whitespace / casing robustness ──────────────────────────────────────────
  test('irregular spacing: "last   month" still resolves to last_month', () => {
    const { period } = resolveDate('total grocery last   month', NOW);
    expect(period).toBe('last_month');
  });

  test('uppercase: "LAST MONTH" resolves to last_month', () => {
    const { period } = resolveDate('TOTAL GROCERY LAST MONTH', NOW);
    expect(period).toBe('last_month');
  });

  test('leading/trailing whitespace is trimmed before matching', () => {
    const { period } = resolveDate('   show expenses this month   ', NOW);
    expect(period).toBe('this_month');
  });
});
