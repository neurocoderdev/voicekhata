import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAppStore } from '../src/store/useAppStore';
import { getAllCategories, getCategoriesGroupedByParent } from '../src/db/categoryRepository';
import { insertExpense, getTotalByCategory } from '../src/db/expenseRepository';
import { resolvePeriod } from '../src/db/queries';
import { formatCurrency, formatExpenseDate, todayIso } from '../src/utils/formatters';
import type { Category } from '../src/db/categoryRepository';

export default function HomeScreen() {
  const isDbReady = useAppStore((s) => s.isDbReady);
  const recentExpenses = useAppStore((s) => s.recentExpenses);
  const refreshExpenses = useAppStore((s) => s.refreshExpenses);

  const [categoryGroups, setCategoryGroups] = useState<Record<string, Category[]>>({});
  const [queryResult, setQueryResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isDbReady) return;
    loadCategoryGroups();
  }, [isDbReady]);

  async function loadCategoryGroups() {
    const groups = await getCategoriesGroupedByParent();
    setCategoryGroups(groups);
  }

  async function handleInsertTestExpense() {
    if (busy) return;
    setBusy(true);
    try {
      const cats = await getAllCategories();
      const gym = cats.find((c) => c.name === 'Gym');
      if (!gym) {
        setQueryResult('Gym category not found — seed may have failed.');
        return;
      }
      await insertExpense({
        amount: 500,
        categoryId: gym.id,
        expenseDate: todayIso(),
        note: 'Test expense from debug screen',
        rawVoice: 'gym 500 rupees paid',
      });
      await refreshExpenses();
      setQueryResult('Inserted: Gym ₹500 today.');
    } finally {
      setBusy(false);
    }
  }

  async function handleQueryTotal() {
    if (busy) return;
    setBusy(true);
    try {
      const cats = await getAllCategories();
      const gym = cats.find((c) => c.name === 'Gym');
      if (!gym) {
        setQueryResult('Gym category not found.');
        return;
      }
      const { startDate, endDate } = resolvePeriod('this_month');
      const total = await getTotalByCategory(gym.id, startDate, endDate);
      setQueryResult(`Gym total this month: ${formatCurrency(total)}`);
    } finally {
      setBusy(false);
    }
  }

  if (!isDbReady) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#7c83fd" />
        <Text style={styles.loadingText}>Initializing database…</Text>
      </View>
    );
  }

  const parentKeys = Object.keys(categoryGroups).sort();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Phase 1 — DB Debug Screen</Text>
      </View>

      {/* Categories */}
      <Text style={styles.sectionTitle}>Seeded Categories</Text>
      {parentKeys.map((parent) => (
        <View key={parent} style={styles.parentGroup}>
          <Text style={styles.parentLabel}>{parent}</Text>
          <View style={styles.chipRow}>
            {categoryGroups[parent].map((cat) => (
              <View key={cat.id} style={styles.chip}>
                <Text style={styles.chipText}>{cat.name}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
      <Text style={styles.categoryCount}>
        {Object.values(categoryGroups).flat().length} categories total
      </Text>

      {/* DB Actions */}
      <Text style={styles.sectionTitle}>DB Operations</Text>
      <TouchableOpacity style={styles.button} onPress={handleInsertTestExpense} disabled={busy}>
        <Text style={styles.buttonText}>Insert test expense (Gym ₹500 today)</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, styles.buttonSecondary]}
        onPress={handleQueryTotal}
        disabled={busy}
      >
        <Text style={styles.buttonText}>Query: Gym total this month</Text>
      </TouchableOpacity>

      {queryResult && (
        <View style={styles.resultBox}>
          <Text style={styles.resultText}>{queryResult}</Text>
        </View>
      )}

      {/* Recent expenses */}
      <Text style={styles.sectionTitle}>Last 10 Expenses</Text>
      {recentExpenses.length === 0 ? (
        <Text style={styles.emptyText}>No expenses yet. Insert a test expense above.</Text>
      ) : (
        <FlatList
          data={recentExpenses}
          keyExtractor={(item) => String(item.id)}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <View style={styles.expenseRow}>
              <View style={styles.expenseLeft}>
                <Text style={styles.expenseCat}>{item.category_name}</Text>
                <Text style={styles.expenseDate}>{formatExpenseDate(item.expense_date)}</Text>
              </View>
              <Text style={styles.expenseAmount}>{formatCurrency(item.amount)}</Text>
            </View>
          )}
        />
      )}
    </ScrollView>
  );
}

const C = {
  bg: '#0f0f1a',
  surface: '#1a1a2e',
  border: '#2a2a4e',
  accent: '#7c83fd',
  green: '#4ade80',
  muted: '#a0a0b0',
  dim: '#60607a',
  white: '#e0e0e0',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: C.muted, marginTop: 12, fontSize: 14 },

  badge: {
    backgroundColor: '#1e3a2f',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  badgeText: { color: C.green, fontSize: 12, fontWeight: '600' },

  sectionTitle: {
    color: C.white,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingBottom: 6,
  },

  parentGroup: { marginBottom: 12 },
  parentLabel: { color: C.accent, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { color: C.muted, fontSize: 12 },
  categoryCount: { color: C.dim, fontSize: 12, marginTop: 4, marginBottom: 4 },

  button: {
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
    alignItems: 'center',
  },
  buttonSecondary: { backgroundColor: '#3a3a6e' },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  resultBox: {
    backgroundColor: C.surface,
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: C.green,
    marginBottom: 10,
  },
  resultText: { color: C.green, fontSize: 14 },

  emptyText: { color: C.dim, fontSize: 13, fontStyle: 'italic', marginTop: 4 },

  expenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  expenseLeft: { flex: 1 },
  expenseCat: { color: C.white, fontSize: 14, fontWeight: '600' },
  expenseDate: { color: C.dim, fontSize: 12, marginTop: 2 },
  expenseAmount: { color: C.accent, fontSize: 15, fontWeight: '700' },
});
