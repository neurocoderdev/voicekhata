import * as SQLite from 'expo-sqlite';
import { deleteDatabaseAsync } from 'expo-sqlite';
import { DB_NAME, SEED_CATEGORIES } from '../utils/constants';

let db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

// Open the database, create the schema, and seed categories. If the file is
// corrupted (open or schema creation throws, or a sanity SELECT fails), delete
// the on-disk database and rebuild from scratch — losing data is acceptable for
// a corrupted store, crashing on every launch is not. Returns whether a reset
// happened so the UI can warn the user that prior data was lost.
export async function initDatabase(): Promise<{ recovered: boolean }> {
  try {
    await openAndMigrate();
    return { recovered: false };
  } catch (e) {
    console.warn('[database] init failed, attempting recovery:', e);
    // Tear down whatever we have, drop the file, and rebuild once.
    try {
      if (db) {
        await db.closeAsync().catch(() => {});
        db = null;
      }
      await deleteDatabaseAsync(DB_NAME).catch(() => {});
    } catch (cleanupErr) {
      console.warn('[database] cleanup before rebuild failed:', cleanupErr);
    }
    // A second failure here is unrecoverable — let it propagate so the caller
    // can show the DB-error screen rather than booting into a broken state.
    await openAndMigrate();
    return { recovered: true };
  }
}

async function openAndMigrate(): Promise<void> {
  db = await SQLite.openDatabaseAsync(DB_NAME);

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

  // Sanity probe — a corrupted file can open and even run DDL yet fail on the
  // first real read. Force one here so corruption surfaces inside initDatabase's
  // try-catch (→ recovery) rather than later at an arbitrary query site.
  await db.getFirstAsync('SELECT COUNT(*) as count FROM categories');

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
