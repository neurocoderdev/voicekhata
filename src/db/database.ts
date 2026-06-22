import * as SQLite from 'expo-sqlite';
import { SEED_CATEGORIES } from '../utils/constants';

let db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export async function initDatabase(): Promise<void> {
  db = await SQLite.openDatabaseAsync('voicekhata.db');

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS categories (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL UNIQUE,
      parent     TEXT,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      amount       REAL    NOT NULL,
      category_id  INTEGER NOT NULL REFERENCES categories(id),
      expense_date TEXT    NOT NULL,
      note         TEXT,
      raw_voice    TEXT,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_expenses_category_date
      ON expenses (category_id, expense_date);

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  await seedCategoriesIfEmpty();
}

async function seedCategoriesIfEmpty(): Promise<void> {
  const result = await getDb().getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM categories'
  );

  if (!result || result.count > 0) return;

  const stmt = await getDb().prepareAsync(
    'INSERT OR IGNORE INTO categories (name, parent) VALUES ($name, $parent)'
  );

  try {
    for (const cat of SEED_CATEGORIES) {
      await stmt.executeAsync({ $name: cat.name, $parent: cat.parent });
    }
  } finally {
    await stmt.finalizeAsync();
  }
}
