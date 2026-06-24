import { getDb } from './database';

// Simple key/value settings, backed by the `settings` table created in
// database.ts. Values are stored as TEXT; booleans are "1"/"0".

export async function getSetting(key: string): Promise<string | null> {
  const row = await getDb().getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

export async function getBoolSetting(key: string, fallback = false): Promise<boolean> {
  const v = await getSetting(key);
  if (v == null) return fallback;
  return v === '1';
}

export async function setBoolSetting(key: string, value: boolean): Promise<void> {
  await setSetting(key, value ? '1' : '0');
}

// Setting keys used by the app.
export const SETTING_CONFIRM_BEFORE_SUBMIT = 'confirm_before_submit';
