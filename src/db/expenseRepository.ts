import { getDb } from './database';

export type Expense = {
  id: number;
  amount: number;
  category_id: number;
  expense_date: string;
  note: string | null;
  raw_voice: string | null;
  created_at: string;
};

export type ExpenseWithCategory = Expense & {
  category_name: string;
  category_parent: string | null;
};

export type InsertExpenseParams = {
  amount: number;
  categoryId: number;
  expenseDate: string;
  note?: string | null;
  rawVoice?: string | null;
};

export type CategoryTotal = {
  category_id: number;
  category_name: string;
  category_parent: string | null;
  total: number;
};

// Per-category expense count + total over a date range. Used by the Categories
// screen so it can show stats for every category in a single query rather than
// one query per category.
export type CategoryStat = {
  category_id: number;
  count: number;
  total: number;
};

export async function insertExpense(params: InsertExpenseParams): Promise<number> {
  const result = await getDb().runAsync(
    `INSERT INTO expenses (amount, category_id, expense_date, note, raw_voice)
     VALUES (?, ?, ?, ?, ?)`,
    [
      params.amount,
      params.categoryId,
      params.expenseDate,
      params.note ?? null,
      params.rawVoice ?? null,
    ]
  );
  return result.lastInsertRowId;
}

export async function getRecentExpenses(limit: number): Promise<ExpenseWithCategory[]> {
  return getDb().getAllAsync<ExpenseWithCategory>(
    `SELECT e.*, c.name as category_name, c.parent as category_parent
     FROM expenses e
     JOIN categories c ON e.category_id = c.id
     ORDER BY e.expense_date DESC, e.created_at DESC
     LIMIT ?`,
    [limit]
  );
}

export async function getExpensesByDateRange(
  startDate: string,
  endDate: string
): Promise<ExpenseWithCategory[]> {
  return getDb().getAllAsync<ExpenseWithCategory>(
    `SELECT e.*, c.name as category_name, c.parent as category_parent
     FROM expenses e
     JOIN categories c ON e.category_id = c.id
     WHERE e.expense_date BETWEEN ? AND ?
     ORDER BY e.expense_date DESC, e.created_at DESC`,
    [startDate, endDate]
  );
}

export async function getTotalByCategory(
  categoryId: number,
  startDate: string,
  endDate: string
): Promise<number> {
  const result = await getDb().getFirstAsync<{ total: number | null }>(
    `SELECT SUM(amount) as total
     FROM expenses
     WHERE category_id = ? AND expense_date BETWEEN ? AND ?`,
    [categoryId, startDate, endDate]
  );
  return result?.total ?? 0;
}

export async function getGrandTotal(startDate: string, endDate: string): Promise<number> {
  const result = await getDb().getFirstAsync<{ total: number | null }>(
    `SELECT SUM(amount) as total
     FROM expenses
     WHERE expense_date BETWEEN ? AND ?`,
    [startDate, endDate]
  );
  return result?.total ?? 0;
}

export async function getCategoryStats(
  startDate: string,
  endDate: string
): Promise<CategoryStat[]> {
  return getDb().getAllAsync<CategoryStat>(
    `SELECT category_id, COUNT(*) as count, SUM(amount) as total
     FROM expenses
     WHERE expense_date BETWEEN ? AND ?
     GROUP BY category_id`,
    [startDate, endDate]
  );
}

export async function getMonthlySummary(
  startDate: string,
  endDate: string
): Promise<CategoryTotal[]> {
  return getDb().getAllAsync<CategoryTotal>(
    `SELECT e.category_id, c.name as category_name, c.parent as category_parent,
            SUM(e.amount) as total
     FROM expenses e
     JOIN categories c ON e.category_id = c.id
     WHERE e.expense_date BETWEEN ? AND ?
     GROUP BY e.category_id
     ORDER BY total DESC`,
    [startDate, endDate]
  );
}
