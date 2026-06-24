import { format, subMonths } from 'date-fns';
import { periodToRange, type Period } from '../parser/dateResolver';

export type { Period };

export type DateRange = {
  startDate: string;
  endDate: string;
};

// Delegate range computation to the parser's periodToRange (single source of
// truth — see Phase 2 note). Null period defaults to the current month.
export function resolvePeriod(period: Period | null): DateRange {
  if (period == null) return periodToRange('this_month');
  return periodToRange(period);
}

export function describePeriod(period: Period | null): string {
  const now = new Date();

  switch (period) {
    case 'this_month':
      return `this month (${format(now, 'MMMM')})`;
    case 'last_month':
      return `last month (${format(subMonths(now, 1), 'MMMM')})`;
    case 'this_week':
      return 'this week';
    case 'last_week':
      return 'last week';
    default:
      return `this month (${format(now, 'MMMM')})`;
  }
}
