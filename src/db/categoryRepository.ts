import { getDb } from './database';

export type Category = {
  id: number;
  name: string;
  parent: string | null;
  created_at: string;
};

export async function getAllCategories(): Promise<Category[]> {
  return getDb().getAllAsync<Category>(
    'SELECT id, name, parent, created_at FROM categories ORDER BY parent, name'
  );
}

export async function getCategoryByName(name: string): Promise<Category | null> {
  return getDb().getFirstAsync<Category>(
    'SELECT id, name, parent, created_at FROM categories WHERE LOWER(name) = LOWER(?)',
    [name]
  );
}

export async function getCategoryById(id: number): Promise<Category | null> {
  return getDb().getFirstAsync<Category>(
    'SELECT id, name, parent, created_at FROM categories WHERE id = ?',
    [id]
  );
}

export async function insertCategory(name: string, parent: string): Promise<number> {
  const result = await getDb().runAsync(
    'INSERT INTO categories (name, parent) VALUES (?, ?)',
    [name, parent]
  );
  return result.lastInsertRowId;
}

export async function deleteCategory(id: number): Promise<void> {
  await getDb().runAsync('DELETE FROM categories WHERE id = ?', [id]);
}

export async function getCategoriesGroupedByParent(): Promise<Record<string, Category[]>> {
  const all = await getAllCategories();
  return all.reduce<Record<string, Category[]>>((groups, cat) => {
    const key = cat.parent ?? 'Other';
    if (!groups[key]) groups[key] = [];
    groups[key].push(cat);
    return groups;
  }, {});
}
