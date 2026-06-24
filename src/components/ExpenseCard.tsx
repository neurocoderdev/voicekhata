import { StyleSheet, Text, View } from 'react-native';
import type { ExpenseWithCategory } from '../db/expenseRepository';
import { formatCurrency, formatExpenseDate } from '../utils/formatters';
import { parentColor } from '../utils/constants';

type Props = {
  expense: ExpenseWithCategory;
  // When true, show the parent group label under the category name (History
  // screen). The Home list keeps it compact and omits it.
  showParent?: boolean;
};

export function ExpenseCard({ expense, showParent = false }: Props) {
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: parentColor(expense.category_parent) }]} />
      <View style={styles.left}>
        <Text style={styles.cat} numberOfLines={1}>
          {expense.category_name}
        </Text>
        {showParent && expense.category_parent ? (
          <Text style={styles.parent}>{expense.category_parent}</Text>
        ) : null}
        <Text style={styles.date}>{formatExpenseDate(expense.expense_date)}</Text>
        {expense.note ? (
          <Text style={styles.note} numberOfLines={1}>
            {expense.note}
          </Text>
        ) : null}
      </View>
      <Text style={styles.amount}>{formatCurrency(expense.amount)}</Text>
    </View>
  );
}

const C = {
  surface: '#16162a',
  border: '#252540',
  accent: '#7c83fd',
  muted: '#a0a0b0',
  dim: '#60607a',
  white: '#e8e8f0',
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginTop: 5,
    marginRight: 10,
  },
  left: { flex: 1, marginRight: 8 },
  cat: { color: C.white, fontSize: 14, fontWeight: '600' },
  parent: { color: C.dim, fontSize: 11, marginTop: 1 },
  date: { color: C.muted, fontSize: 12, marginTop: 3 },
  note: { color: C.dim, fontSize: 12, fontStyle: 'italic', marginTop: 2 },
  amount: { color: C.accent, fontSize: 15, fontWeight: '700' },
});
