import { format, parseISO } from 'date-fns';

export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function formatExpenseDate(isoDate: string): string {
  try {
    return format(parseISO(isoDate), 'd MMM yyyy');
  } catch {
    return isoDate;
  }
}

export function formatMonthLabel(isoDate: string): string {
  try {
    return format(parseISO(isoDate), 'MMMM yyyy');
  } catch {
    return isoDate;
  }
}

export function todayIso(): string {
  return format(new Date(), 'yyyy-MM-dd');
}
