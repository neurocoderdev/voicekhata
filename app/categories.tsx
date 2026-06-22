import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getCategoriesGroupedByParent, type Category } from '../src/db/categoryRepository';
import { getTotalByCategory } from '../src/db/expenseRepository';
import { resolvePeriod } from '../src/db/queries';
import { useAppStore } from '../src/store/useAppStore';
import { formatCurrency } from '../src/utils/formatters';

type CategoryWithTotal = Category & { total: number };

export default function CategoriesScreen() {
  const isDbReady = useAppStore((s) => s.isDbReady);
  const [groups, setGroups] = useState<Record<string, CategoryWithTotal[]>>({});
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (isDbReady) load();
  }, [isDbReady]);

  async function load() {
    const raw = await getCategoriesGroupedByParent();
    const { startDate, endDate } = resolvePeriod('this_month');

    const enriched: Record<string, CategoryWithTotal[]> = {};
    for (const [parent, cats] of Object.entries(raw)) {
      enriched[parent] = await Promise.all(
        cats.map(async (cat) => ({
          ...cat,
          total: await getTotalByCategory(cat.id, startDate, endDate),
        }))
      );
    }
    setGroups(enriched);
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

  const parentKeys = Object.keys(groups).sort();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7c83fd" />}
    >
      <Text style={styles.subtitle}>Spending by category — this month</Text>

      {parentKeys.map((parent) => (
        <View key={parent} style={styles.section}>
          <Text style={styles.parentHeader}>{parent}</Text>
          {groups[parent].map((cat) => (
            <View key={cat.id} style={styles.catRow}>
              <Text style={styles.catName}>{cat.name}</Text>
              <Text style={[styles.catTotal, cat.total > 0 && styles.catTotalActive]}>
                {cat.total > 0 ? formatCurrency(cat.total) : '—'}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
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
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  subtitle: { color: C.dim, fontSize: 13, marginBottom: 16 },

  section: {
    backgroundColor: C.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 14,
    overflow: 'hidden',
  },
  parentHeader: {
    color: C.accent,
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#1e1e38',
    letterSpacing: 0.5,
  },
  catRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  catName: { color: C.white, fontSize: 14 },
  catTotal: { color: C.dim, fontSize: 14 },
  catTotalActive: { color: C.accent, fontWeight: '600' },
});
