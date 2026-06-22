import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getExpensesByDateRange, type ExpenseWithCategory } from '../src/db/expenseRepository';
import { useAppStore } from '../src/store/useAppStore';
import { formatCurrency, formatExpenseDate } from '../src/utils/formatters';

export default function HistoryScreen() {
  const isDbReady = useAppStore((s) => s.isDbReady);
  const [expenses, setExpenses] = useState<ExpenseWithCategory[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (isDbReady) load();
  }, [isDbReady]);

  async function load() {
    // Show all time: 2020-01-01 to 2099-12-31
    const all = await getExpensesByDateRange('2020-01-01', '2099-12-31');
    setExpenses(all);
  }

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (!isDbReady) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#7c83fd" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={expenses}
      keyExtractor={(item) => String(item.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7c83fd" />}
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No expenses yet.</Text>
          <Text style={styles.emptyHint}>Go to Home and add a test expense.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.left}>
            <Text style={styles.cat}>{item.category_name}</Text>
            {item.category_parent && (
              <Text style={styles.parent}>{item.category_parent}</Text>
            )}
            <Text style={styles.date}>{formatExpenseDate(item.expense_date)}</Text>
            {item.note && <Text style={styles.note}>{item.note}</Text>}
          </View>
          <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
        </View>
      )}
    />
  );
}

const C = {
  bg: '#0f0f1a',
  surface: '#1a1a2e',
  border: '#2a2a4e',
  accent: '#7c83fd',
  muted: '#a0a0b0',
  dim: '#60607a',
  white: '#e0e0e0',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 40, flexGrow: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { color: C.muted, fontSize: 16, fontWeight: '600' },
  emptyHint: { color: C.dim, fontSize: 13, marginTop: 6 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: C.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  left: { flex: 1, marginRight: 8 },
  cat: { color: C.white, fontSize: 14, fontWeight: '600' },
  parent: { color: C.dim, fontSize: 11, marginTop: 1 },
  date: { color: C.muted, fontSize: 12, marginTop: 4 },
  note: { color: C.dim, fontSize: 12, fontStyle: 'italic', marginTop: 2 },
  amount: { color: C.accent, fontSize: 15, fontWeight: '700' },
});
