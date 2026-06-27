import {
  documentDirectory,
  getInfoAsync,
  makeDirectoryAsync,
  writeAsStringAsync,
  StorageAccessFramework as SAF,
} from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { getExpensesByDateRange, getMonthlySummary } from '../db/expenseRepository';
import { getAllCategories, type Category } from '../db/categoryRepository';
import { getSetting, setSetting } from '../db/settingsRepository';
import { buildCsv, buildSummary, monthDirName } from './csvFormat';

// Re-export pure builders for single-import convenience.
export { buildCsv, buildSummary, escapeCsvField, monthDirName } from './csvFormat';

// ─── Storage strategy ───────────────────────────────────────────────────────
//
// Two-tier, MIUI-proof, no special permissions:
//
//   1. CANONICAL — app-private storage (documentDirectory). This ALWAYS works
//      on every Android version: no permission, no manifest flag, never denied.
//      Every export writes here first, and the share sheet shares from here.
//
//   2. OPTIONAL MIRROR — a user-picked folder via the Storage Access Framework
//      (SAF). The user taps "Choose export folder" once; Android grants a
//      persistable write grant to that tree (e.g. Documents/VoiceKhata) which
//      ANY file manager can browse. We persist the granted tree URI in settings
//      and copy each export there too. SAF write grants are honoured by MIUI —
//      this is why it succeeds where direct /sdcard writes fail.
//
// No WRITE_EXTERNAL_STORAGE, no requestLegacyExternalStorage, no targetSdk pin.

export const EXPORT_ROOT = 'VoiceKhata';

// Persisted SAF tree URI of the user-chosen export folder (null until picked).
const SETTING_EXPORT_TREE_URI = 'export_tree_uri';

export type ExportResult = {
  /** Canonical app-private CSV URI — always present, used for sharing. */
  csvUri: string;
  /** Canonical app-private summary URI. */
  summaryUri: string;
  /** Canonical app-private month directory URI. */
  dirUri: string;
  /** SAF URI of the CSV copy in the user folder, if a folder is configured. */
  externalCsvUri: string | null;
  monthLabel: string;
  count: number;
};

// ─── App-private path helpers ──────────────────────────────────────────────

function appRootUri(): string {
  // documentDirectory is non-null on Android; assert for TS.
  return `${documentDirectory}${EXPORT_ROOT}/`;
}

function monthDirUri(year: number, month: number): string {
  const monthDate = new Date(year, month - 1, 1);
  return `${appRootUri()}${year}/${monthDirName(monthDate)}/`;
}

async function ensureDirAsync(uri: string): Promise<void> {
  const info = await getInfoAsync(uri);
  if (!info.exists) {
    await makeDirectoryAsync(uri, { intermediates: true });
  }
}

// ─── SAF (user-chosen folder) helpers ───────────────────────────────────────

/** The persisted SAF tree URI, or null if the user hasn't chosen a folder. */
export async function getExportFolderUri(): Promise<string | null> {
  return getSetting(SETTING_EXPORT_TREE_URI);
}

export async function hasExportFolder(): Promise<boolean> {
  return (await getExportFolderUri()) != null;
}

/**
 * Prompt the user (via the system folder picker) to choose a folder where
 * exports should also be saved, browsable in any file manager. Persists the
 * granted tree URI. Returns true if a folder was granted, false if cancelled.
 */
export async function chooseExportFolder(): Promise<boolean> {
  const initial = SAF.getUriForDirectoryInRoot('Documents');
  const perm = await SAF.requestDirectoryPermissionsAsync(initial);
  if (!perm.granted) return false;
  await setSetting(SETTING_EXPORT_TREE_URI, perm.directoryUri);
  return true;
}

/** Forget the chosen folder; future exports go to app storage / share only. */
export async function clearExportFolder(): Promise<void> {
  await setSetting(SETTING_EXPORT_TREE_URI, '');
}

// Flat, descriptive filename for the user folder (SAF has no nested-path URIs;
// we keep the nice year/month tree only in app-private storage).
function externalBaseName(year: number, month: number): string {
  const monthDate = new Date(year, month - 1, 1);
  return `${EXPORT_ROOT}-${year}-${format(monthDate, 'MM-MMMM')}`;
}

// Write a string into the SAF tree, overwriting any prior file with the same
// display name so re-exporting a month doesn't pile up "expenses (1).csv"
// duplicates. createFileAsync returns a content:// URI we then write to.
// `fileName` is WITHOUT extension — SAF appends one from the mime type.
async function writeToSafTree(
  treeUri: string,
  fileName: string,
  ext: string,
  mimeType: string,
  contents: string
): Promise<string> {
  // Remove a previous copy if present (best-effort — listing/deleting may fail
  // on some providers; createFileAsync then just makes a suffixed name).
  try {
    const existing = await SAF.readDirectoryAsync(treeUri);
    const target = `${fileName}.${ext}`;
    const match = existing.find((uri) => decodeURIComponent(uri).endsWith('/' + target));
    if (match) await SAF.deleteAsync(match, { idempotent: true });
  } catch {
    // ignore — fall through to create
  }
  const fileUri = await SAF.createFileAsync(treeUri, fileName, mimeType);
  await SAF.writeAsStringAsync(fileUri, contents);
  return fileUri;
}

// Copy the export into the user-chosen folder if one is configured. Never
// throws — a SAF failure (revoked grant, etc.) must not fail the whole export,
// since the canonical app-private copy already succeeded. Returns the CSV's SAF
// URI on success, or null.
async function mirrorToExportFolder(
  year: number,
  month: number,
  csv: string,
  summary: string
): Promise<string | null> {
  const treeUri = await getExportFolderUri();
  if (!treeUri) return null;
  try {
    const base = externalBaseName(year, month);
    const csvUri = await writeToSafTree(treeUri, `${base}-expenses`, 'csv', 'text/csv', csv);
    await writeToSafTree(treeUri, `${base}-summary`, 'txt', 'text/plain', summary);
    return csvUri;
  } catch (e) {
    console.warn('[csvExporter] mirror to export folder failed:', e);
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Export all expenses for a calendar month. Always writes to app-private
 * storage; additionally mirrors to the user-chosen folder if one is set.
 */
export async function exportMonth(year: number, month: number): Promise<ExportResult> {
  const monthDate = new Date(year, month - 1, 1);
  const startDate = format(startOfMonth(monthDate), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(monthDate), 'yyyy-MM-dd');
  const monthLabel = format(monthDate, 'MMMM yyyy');

  const expenses = await getExpensesByDateRange(startDate, endDate);
  const totals = await getMonthlySummary(startDate, endDate);
  const grandTotal = totals.reduce((sum, t) => sum + t.total, 0);

  const csv = buildCsv(expenses);
  const summary = buildSummary(monthLabel, totals, grandTotal);

  // 1. Canonical app-private write — this is the source of truth and never fails
  //    under normal conditions (no permission, app's own sandbox).
  const dirUri = monthDirUri(year, month);
  const csvUri = `${dirUri}expenses.csv`;
  const summaryUri = `${dirUri}summary.txt`;
  try {
    await ensureDirAsync(dirUri);
    await writeAsStringAsync(csvUri, csv);
    await writeAsStringAsync(summaryUri, summary);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Could not save the export: ${msg}`);
  }

  // 2. Optional mirror to the user-chosen folder (best-effort, never throws).
  const externalCsvUri = await mirrorToExportFolder(year, month, csv, summary);

  return { csvUri, summaryUri, dirUri, externalCsvUri, monthLabel, count: expenses.length };
}

export async function exportCurrentMonth(now: Date = new Date()): Promise<ExportResult> {
  return exportMonth(now.getFullYear(), now.getMonth() + 1);
}

export async function exportLastMonth(now: Date = new Date()): Promise<ExportResult> {
  const prev = subMonths(now, 1);
  return exportMonth(prev.getFullYear(), prev.getMonth() + 1);
}

export async function shareFile(fileUri: string): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(fileUri, {
    mimeType: 'text/csv',
    dialogTitle: 'Share VoiceKhata export',
    UTI: 'public.comma-separated-values-text',
  });
}

export async function exportCategories(): Promise<string> {
  const categories: Category[] = await getAllCategories();
  const json = JSON.stringify(
    categories.map((c) => ({ name: c.name, parent: c.parent })),
    null,
    2
  );
  const rootUri = appRootUri();
  try {
    await ensureDirAsync(rootUri);
    const fileUri = `${rootUri}categories.json`;
    await writeAsStringAsync(fileUri, json);
    // Mirror to the user folder too, if configured (best-effort).
    const treeUri = await getExportFolderUri();
    if (treeUri) {
      try {
        await writeToSafTree(treeUri, `${EXPORT_ROOT}-categories`, 'json', 'application/json', json);
      } catch (e) {
        console.warn('[csvExporter] mirror categories backup failed:', e);
      }
    }
    return fileUri;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Could not write categories backup: ${msg}`);
  }
}

export async function monthExportExists(year: number, month: number): Promise<boolean> {
  const csvUri = `${monthDirUri(year, month)}expenses.csv`;
  const info = await getInfoAsync(csvUri);
  return info.exists;
}

/**
 * On launch: export the previous month once, if it has expenses and hasn't been
 * exported yet. Writes to app-private storage (and mirrors if a folder is set).
 * Never throws — startup must not be blocked by an export failure.
 */
export async function autoExportPreviousMonth(
  now: Date = new Date()
): Promise<ExportResult | null> {
  try {
    const prev = subMonths(now, 1);
    const year = prev.getFullYear();
    const month = prev.getMonth() + 1;

    if (await monthExportExists(year, month)) return null;

    const startDate = format(startOfMonth(prev), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(prev), 'yyyy-MM-dd');
    const expenses = await getExpensesByDateRange(startDate, endDate);
    if (expenses.length === 0) return null;

    return await exportMonth(year, month);
  } catch (e) {
    console.warn('[csvExporter] auto-export failed:', e);
    return null;
  }
}
