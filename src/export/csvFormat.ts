import { format } from 'date-fns';
import type { ExpenseWithCategory, CategoryTotal } from '../db/expenseRepository';

// Pure CSV/summary builders — no native modules, no DB, no device. Kept separate
// from csvExporter.ts (which does file I/O) so this logic is unit-testable in a
// plain Node Jest environment, per the project's pure-test standard.

// Escape a single CSV field per RFC 4180: wrap in double quotes and double any
// embedded quotes when the value contains a comma, quote, or newline.
export function escapeCsvField(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// Build the CSV text for a list of expenses. Always emits the header row, so an
// empty month yields a header-only file rather than an empty one.
export function buildCsv(expenses: ExpenseWithCategory[]): string {
  const header = ['Date', 'Category', 'Amount', 'Note'];
  const rows = expenses.map((e) =>
    [
      escapeCsvField(e.expense_date),
      escapeCsvField(e.category_name),
      escapeCsvField(e.amount),
      escapeCsvField(e.note),
    ].join(',')
  );
  // Trailing newline keeps the file POSIX-clean and Sheets-friendly.
  return [header.join(','), ...rows].join('\n') + '\n';
}

// Build the human-readable summary.txt: per-category totals (highest first) and
// a grand total. Empty months get a clear "No expenses" body.
export function buildSummary(
  monthLabel: string,
  totals: CategoryTotal[],
  grandTotal: number
): string {
  const title = `VoiceKhata — ${monthLabel}`;
  const lines: string[] = [];
  lines.push(title);
  lines.push('='.repeat(title.length));
  lines.push('');

  if (totals.length === 0) {
    lines.push('No expenses recorded for this month.');
    lines.push('');
    return lines.join('\n');
  }

  lines.push('Category-wise totals:');
  // Pad category names so the rupee columns line up in a monospace viewer.
  const nameWidth = Math.max(...totals.map((t) => t.category_name.length), 8);
  for (const t of totals) {
    const name = t.category_name.padEnd(nameWidth);
    lines.push(`  ${name}   ₹${t.total.toLocaleString('en-IN')}`);
  }
  lines.push('');
  lines.push(`Grand total:   ₹${grandTotal.toLocaleString('en-IN')}`);
  lines.push('');
  return lines.join('\n');
}

// Directory segment for a month, e.g. "06-June". Stable, sortable, readable.
export function monthDirName(monthDate: Date): string {
  return format(monthDate, 'MM-MMMM');
}

// User-ready, TTS-friendly message for a storage-full export failure.
export const STORAGE_FULL_MESSAGE = 'Storage full. Free some space and try again.';

// True when an error message indicates the device is out of storage. Out-of-space
// surfaces under several spellings across the FS/SAF layers (ENOSPC, "no space
// left on device", "disk full", "not enough space") — match them all so the
// export path can show the actionable message instead of a raw error. Also
// recognizes STORAGE_FULL_MESSAGE itself, so a message that has ALREADY been
// converted (re-thrown by exportMonth) is still classified as storage-full by
// downstream callers and spoken as-is rather than double-wrapped.
export function isStorageFullError(message: string): boolean {
  return (
    /enospc|no space|disk full|no space left|not enough space|insufficient storage|storage full/i.test(
      message
    )
  );
}
