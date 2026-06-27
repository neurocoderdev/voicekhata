import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getExpensesByDateRange, type ExpenseWithCategory } from '../src/db/expenseRepository';
import { useAppStore } from '../src/store/useAppStore';
import { ExpenseCard } from '../src/components/ExpenseCard';

export default function HistoryScreen() {
  const isDbReady = useAppStore((s) => s.isDbReady);
  const [expenses, setExpenses] = useState<ExpenseWithCategory[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    // All time. SQLite handles thousands of rows; no pagination needed in v1.
    const all = await getExpensesByDateRange('2000-01-01', '2099-12-31');
    setExpenses(all);
  }, []);

  // Reload every time the tab gains focus so expenses added on Home appear here.
  useFocusEffect(
    useCallback(() => {
      if (isDbReady) load();
    }, [isDbReady, load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (!isDbReady) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={expenses}
      keyExtractor={(item) => String(item.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No expenses yet.</Text>
          <Text style={styles.emptyHint}>Go to Home and tap the mic.</Text>
        </View>
      }
      renderItem={({ item }) => <ExpenseCard expense={item} showParent />}
      showsVerticalScrollIndicator={false}
      // Perf for long histories (500+ rows): render a screenful first, fill the
      // rest in small batches, and recycle off-screen rows.
      initialNumToRender={12}
      maxToRenderPerBatch={10}
      windowSize={11}
      removeClippedSubviews
    />
  );
}

const C = {
  bg: '#0f0f1a',
  accent: '#7c83fd',
  muted: '#a0a0b0',
  dim: '#60607a',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 40, flexGrow: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { color: C.muted, fontSize: 16, fontWeight: '600' },
  emptyHint: { color: C.dim, fontSize: 13, marginTop: 6 },
});
