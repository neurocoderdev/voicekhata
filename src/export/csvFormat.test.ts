import {
  buildCsv,
  buildSummary,
  escapeCsvField,
  monthDirName,
  isStorageFullError,
  STORAGE_FULL_MESSAGE,
} from './csvFormat';
import type { ExpenseWithCategory, CategoryTotal } from '../db/expenseRepository';

// Helper to build a minimal ExpenseWithCategory row for tests.
function exp(over: Partial<ExpenseWithCategory>): ExpenseWithCategory {
  return {
    id: 1,
    amount: 100,
    category_id: 1,
    expense_date: '2026-06-21',
    note: null,
    raw_voice: null,
    created_at: '2026-06-21T10:00:00Z',
    category_name: 'Gym',
    category_parent: 'Personal',
    ...over,
  };
}

function tot(name: string, total: number): CategoryTotal {
  return { category_id: 1, category_name: name, category_parent: 'Personal', total };
}

describe('escapeCsvField', () => {
  test('plain values pass through unchanged', () => {
    expect(escapeCsvField('Gym')).toBe('Gym');
    expect(escapeCsvField(500)).toBe('500');
  });

  test('null / undefined become empty string', () => {
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });

  test('values with commas are quoted', () => {
    expect(escapeCsvField('lunch, dinner')).toBe('"lunch, dinner"');
  });

  test('embedded quotes are doubled and wrapped', () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });

  test('newlines force quoting', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCsvField('a\rb')).toBe('"a\rb"');
  });
});

describe('buildCsv', () => {
  test('empty month yields header-only file', () => {
    expect(buildCsv([])).toBe('Date,Category,Amount,Note\n');
  });

  test('single row renders all four columns', () => {
    const csv = buildCsv([exp({ expense_date: '2026-06-21', category_name: 'Gym', amount: 500, note: 'monthly' })]);
    expect(csv).toBe('Date,Category,Amount,Note\n2026-06-21,Gym,500,monthly\n');
  });

  test('note with a comma is quoted, other fields are not', () => {
    const csv = buildCsv([exp({ amount: 200, category_name: 'Restaurant', note: 'pizza, coke' })]);
    expect(csv).toContain('Restaurant,200,"pizza, coke"');
  });

  test('note with embedded quotes is escaped', () => {
    const csv = buildCsv([exp({ note: 'said "thanks"' })]);
    expect(csv).toContain('"said ""thanks"""');
  });

  test('null note renders as empty field', () => {
    const csv = buildCsv([exp({ category_name: 'Auto', amount: 50, note: null })]);
    expect(csv.trim().split('\n')[1]).toBe('2026-06-21,Auto,50,');
  });

  test('multiple rows each get their own line', () => {
    const csv = buildCsv([
      exp({ category_name: 'Gym', amount: 500 }),
      exp({ category_name: 'Auto', amount: 60 }),
    ]);
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(3); // header + 2
  });
});

describe('buildSummary', () => {
  test('empty month says no expenses', () => {
    const s = buildSummary('June 2026', [], 0);
    expect(s).toContain('VoiceKhata — June 2026');
    expect(s).toContain('No expenses recorded for this month.');
    expect(s).not.toContain('Grand total');
  });

  test('lists per-category totals and grand total', () => {
    const s = buildSummary('June 2026', [tot('Gym', 1000), tot('Auto', 240)], 1240);
    expect(s).toContain('Gym');
    expect(s).toContain('₹1,000');
    expect(s).toContain('Auto');
    expect(s).toContain('₹240');
    expect(s).toContain('Grand total:');
    expect(s).toContain('₹1,240');
  });

  test('grand total uses Indian digit grouping', () => {
    const s = buildSummary('June 2026', [tot('Rent', 150000)], 150000);
    expect(s).toContain('₹1,50,000');
  });

  test('title underline matches title length', () => {
    const s = buildSummary('May 2026', [], 0);
    const lines = s.split('\n');
    expect(lines[1]).toBe('='.repeat(lines[0].length));
  });
});

describe('monthDirName', () => {
  test('formats as MM-MonthName', () => {
    expect(monthDirName(new Date(2026, 5, 1))).toBe('06-June');
    expect(monthDirName(new Date(2026, 0, 15))).toBe('01-January');
    expect(monthDirName(new Date(2026, 11, 31))).toBe('12-December');
  });
});

describe('isStorageFullError', () => {
  test('matches the common out-of-space spellings', () => {
    expect(isStorageFullError('write failed: ENOSPC (No space left on device)')).toBe(true);
    expect(isStorageFullError('No space left on device')).toBe(true);
    expect(isStorageFullError('Disk full')).toBe(true);
    expect(isStorageFullError('Not enough space to write file')).toBe(true);
    expect(isStorageFullError('Insufficient storage available')).toBe(true);
  });

  test('is case-insensitive', () => {
    expect(isStorageFullError('enospc')).toBe(true);
    expect(isStorageFullError('NO SPACE LEFT')).toBe(true);
  });

  test('classifies the already-converted STORAGE_FULL_MESSAGE (round-trip)', () => {
    // exportMonth re-throws this exact string; downstream callers must still
    // recognize it as storage-full so they speak it as-is, not double-wrapped.
    expect(isStorageFullError(STORAGE_FULL_MESSAGE)).toBe(true);
  });

  test('does not match unrelated errors', () => {
    expect(isStorageFullError('Permission denied')).toBe(false);
    expect(isStorageFullError('Network unreachable')).toBe(false);
    expect(isStorageFullError('Could not open database')).toBe(false);
    expect(isStorageFullError('')).toBe(false);
  });
});
