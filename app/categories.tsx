import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  getCategoriesGroupedByParent,
  insertCategory,
  deleteCategory,
  getCategoryByName,
  type Category,
} from '../src/db/categoryRepository';
import { getCategoryStats } from '../src/db/expenseRepository';
import { useAppStore } from '../src/store/useAppStore';
import { formatCurrency } from '../src/utils/formatters';
import { parentColor, SEED_CATEGORY_NAMES, CATEGORY_PARENTS } from '../src/utils/constants';

type CategoryWithStats = Category & { count: number; total: number };

export default function CategoriesScreen() {
  const isDbReady = useAppStore((s) => s.isDbReady);
  const refreshCategories = useAppStore((s) => s.refreshCategories);

  const [groups, setGroups] = useState<Record<string, CategoryWithStats[]>>({});
  const [refreshing, setRefreshing] = useState(false);

  // Add-category form state.
  const [newName, setNewName] = useState('');
  const [newParent, setNewParent] = useState<string>('Personal');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const raw = await getCategoriesGroupedByParent();
    // All-time stats — counts + totals for every category in one query.
    const stats = await getCategoryStats('2000-01-01', '2099-12-31');
    const byId = new Map(stats.map((s) => [s.category_id, s]));

    const enriched: Record<string, CategoryWithStats[]> = {};
    for (const [parent, cats] of Object.entries(raw)) {
      enriched[parent] = cats.map((cat) => ({
        ...cat,
        count: byId.get(cat.id)?.count ?? 0,
        total: byId.get(cat.id)?.total ?? 0,
      }));
    }
    setGroups(enriched);
  }, []);

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

  const onAdd = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const existing = await getCategoryByName(name);
      if (existing) {
        Alert.alert('Already exists', `"${name}" already exists under ${existing.parent ?? 'Other'}.`);
        return;
      }
      const tidy = name.charAt(0).toUpperCase() + name.slice(1);
      await insertCategory(tidy, newParent);
      setNewName('');
      await refreshCategories(); // keep the parser's category cache in sync
      await load();
    } catch (e) {
      Alert.alert('Error', 'Could not add category.');
    } finally {
      setSaving(false);
    }
  }, [newName, newParent, refreshCategories, load]);

  const onDelete = useCallback(
    (cat: CategoryWithStats) => {
      const isSeed = SEED_CATEGORY_NAMES.has(cat.name.toLowerCase());
      if (isSeed) {
        Alert.alert('Protected', 'Default categories cannot be deleted.');
        return;
      }
      const warn =
        cat.count > 0
          ? `"${cat.name}" has ${cat.count} expense${cat.count === 1 ? '' : 's'}. Deleting it will orphan them. Continue?`
          : `Delete category "${cat.name}"?`;
      Alert.alert('Delete category', warn, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteCategory(cat.id);
            await refreshCategories();
            await load();
          },
        },
      ]);
    },
    [refreshCategories, load]
  );

  if (!isDbReady) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }

  const parentKeys = Object.keys(groups).sort();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
    >
      <Text style={styles.subtitle}>All categories — tap a custom one to delete</Text>

      {parentKeys.map((parent) => (
        <View key={parent} style={styles.section}>
          <View style={styles.parentHeaderRow}>
            <View style={[styles.parentDot, { backgroundColor: parentColor(parent) }]} />
            <Text style={styles.parentHeader}>{parent}</Text>
          </View>
          {groups[parent].map((cat) => {
            const isSeed = SEED_CATEGORY_NAMES.has(cat.name.toLowerCase());
            return (
              <TouchableOpacity
                key={cat.id}
                style={styles.catRow}
                activeOpacity={isSeed ? 1 : 0.6}
                onPress={() => !isSeed && onDelete(cat)}
              >
                <View style={styles.catLeft}>
                  <Text style={styles.catName}>
                    {cat.name}
                    {!isSeed ? <Text style={styles.customTag}>  · custom</Text> : null}
                  </Text>
                  <Text style={styles.catCount}>
                    {cat.count} expense{cat.count === 1 ? '' : 's'}
                  </Text>
                </View>
                <Text style={[styles.catTotal, cat.total > 0 && styles.catTotalActive]}>
                  {cat.total > 0 ? formatCurrency(cat.total) : '—'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {/* ── Add category ──────────────────────────────────────────────────── */}
      <View style={styles.addBox}>
        <Text style={styles.addTitle}>Add a category</Text>
        <TextInput
          style={styles.input}
          placeholder="Category name (e.g. Clothes)"
          placeholderTextColor={C.dim}
          value={newName}
          onChangeText={setNewName}
          autoCapitalize="words"
        />
        <Text style={styles.parentLabel}>Under</Text>
        <View style={styles.parentChips}>
          {CATEGORY_PARENTS.map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.chip, newParent === p && styles.chipActive]}
              onPress={() => setNewParent(p)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, newParent === p && styles.chipTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.addBtn, (!newName.trim() || saving) && styles.addBtnDisabled]}
          onPress={onAdd}
          disabled={!newName.trim() || saving}
          activeOpacity={0.8}
        >
          <Text style={styles.addBtnText}>{saving ? 'Adding…' : 'Add Category'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const C = {
  bg: '#0f0f1a',
  surface: '#16162a',
  surfaceHigh: '#1e1e36',
  border: '#252540',
  accent: '#7c83fd',
  muted: '#a0a0b0',
  dim: '#60607a',
  white: '#e8e8f0',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 48 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  subtitle: { color: C.dim, fontSize: 13, marginBottom: 16 },

  section: {
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 14,
    overflow: 'hidden',
  },
  parentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: C.surfaceHigh,
  },
  parentDot: { width: 9, height: 9, borderRadius: 5 },
  parentHeader: { color: C.white, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  catRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  catLeft: { flex: 1 },
  catName: { color: C.white, fontSize: 14 },
  customTag: { color: C.dim, fontSize: 11, fontStyle: 'italic' },
  catCount: { color: C.dim, fontSize: 11, marginTop: 2 },
  catTotal: { color: C.dim, fontSize: 14 },
  catTotalActive: { color: C.accent, fontWeight: '600' },

  // Add category form
  addBox: {
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginTop: 6,
  },
  addTitle: { color: C.white, fontSize: 15, fontWeight: '700', marginBottom: 12 },
  input: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: C.white,
    fontSize: 14,
  },
  parentLabel: {
    color: C.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 8,
  },
  parentChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bg,
  },
  chipActive: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { color: C.muted, fontSize: 13 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  addBtn: {
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  addBtnDisabled: { backgroundColor: '#2e2e50' },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
