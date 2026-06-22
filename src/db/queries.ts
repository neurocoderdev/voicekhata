import { format, startOfMonth, endOfMonth, subMonths, startOfWeek } from 'date-fns';

export type Period = 'this_month' | 'last_month' | 'this_week';

export type DateRange = {
  startDate: string;
  endDate: string;
};

export function resolvePeriod(period: Period | null): DateRange {
  const now = new Date();
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

  switch (period) {
    case 'this_month':
      return {
        startDate: fmt(startOfMonth(now)),
        endDate: fmt(endOfMonth(now)),
      };
    case 'last_month': {
      const lastMonth = subMonths(now, 1);
      return {
        startDate: fmt(startOfMonth(lastMonth)),
        endDate: fmt(endOfMonth(lastMonth)),
      };
    }
    case 'this_week':
      return {
        startDate: fmt(startOfWeek(now, { weekStartsOn: 1 })),
        endDate: fmt(now),
      };
    default:
      // Default to current month when period is null
      return {
        startDate: fmt(startOfMonth(now)),
        endDate: fmt(endOfMonth(now)),
      };
  }
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
    default:
      return `this month (${format(now, 'MMMM')})`;
  }
}
