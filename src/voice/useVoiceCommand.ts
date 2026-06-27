import { useCallback } from 'react';
import { parseIntent } from '../parser/intentParser';
import { resolvePeriod } from '../db/queries';
import {
  insertExpense,
  getTotalByCategory,
  getGrandTotal,
} from '../db/expenseRepository';
import { insertCategory, getCategoryByName } from '../db/categoryRepository';
import {
  exportCurrentMonth,
  exportLastMonth,
  shareFile,
  isStorageFullError,
  type ExportResult,
} from '../export/csvExporter';
import { useAppStore } from '../store/useAppStore';
import { CATEGORY_PARENTS } from '../utils/constants';
import { formatExpenseDate } from '../utils/formatters';
import type { TtsState } from './useTts';

// Result of handling one command. The screen uses `kind` only for light styling
// of the feedback line; `message` is exactly what TTS speaks.
export type CommandOutcome = {
  kind: 'added' | 'query' | 'created' | 'export' | 'prompt' | 'unknown' | 'error';
  message: string;
};

// Spoken/displayed amounts. Render as a plain number — no thousands commas (the
// TTS engine reads "1,000" oddly) and no forced ".00" on whole rupees.
function speakAmount(amount: number): string {
  return String(amount);
}

// Map a spoken parent ("personal") to the canonical seed-parent name
// ("Personal"). Falls back to a title-cased version of whatever was said so a
// user-invented parent still gets a tidy label rather than a raw lowercase word.
function normalizeParent(spoken: string): string {
  const lower = spoken.trim().toLowerCase();
  const known = CATEGORY_PARENTS.find((p) => p.toLowerCase() === lower);
  if (known) return known;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function titleCase(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export type VoiceCommandApi = {
  // Parse + execute a raw transcription, speak the response, refresh the store.
  // Returns the outcome so the screen can show the same text on-screen.
  handleCommand: (rawText: string) => Promise<CommandOutcome>;
};

// The orchestrator. Takes the TTS hook so it can speak responses and so the
// caller controls the single shared speech engine (mic and TTS must never run
// concurrently — the screen disables the mic while `tts.isSpeaking`).
export function useVoiceCommand(tts: TtsState): VoiceCommandApi {
  const refreshAll = useAppStore((s) => s.refreshAll);
  const refreshCategories = useAppStore((s) => s.refreshCategories);

  const handleCommand = useCallback(
    async (rawText: string): Promise<CommandOutcome> => {
      const text = (rawText ?? '').trim();

      // ── Empty transcript ──────────────────────────────────────────────────
      if (!text) {
        const message = "I didn't catch that. Please try again.";
        tts.speak(message);
        return { kind: 'error', message };
      }

      // Read categories at call time (not via a subscribed snapshot) so the
      // parser's fuzzy matcher always sees the freshest list — including a
      // category created moments earlier in this same session — with no
      // dependency on React render timing.
      const categories = useAppStore.getState().categories;

      let outcome: CommandOutcome;
      try {
        const intent = parseIntent(text, categories);

        switch (intent.action) {
          // ── ADD ─────────────────────────────────────────────────────────
          case 'ADD': {
            // Amount missing or non-positive — heard the category, not the value.
            if (intent.amount == null || intent.amount <= 0) {
              outcome = {
                kind: 'prompt',
                message: 'I heard the category but not the amount. Please try again.',
              };
              break;
            }

            // Category string present but no DB match → ask the user to create it.
            if (intent.categoryId == null) {
              const spoken = intent.category ?? 'that';
              outcome = {
                kind: 'prompt',
                message: `I don't have a category called ${spoken}. Say create category ${spoken} under personal, to add it.`,
              };
              break;
            }

            await insertExpense({
              amount: intent.amount,
              categoryId: intent.categoryId,
              expenseDate: intent.date,
              rawVoice: text,
            });

            // Running monthly total for the category, for the spoken confirmation.
            const { startDate, endDate } = resolvePeriod('this_month');
            const monthTotal = await getTotalByCategory(
              intent.categoryId,
              startDate,
              endDate
            );

            const dateLabel = formatExpenseDate(intent.date);
            outcome = {
              kind: 'added',
              message: `Added ${speakAmount(intent.amount)} rupees to ${intent.category} for ${dateLabel}. Total this month: ${speakAmount(monthTotal)} rupees.`,
            };
            break;
          }

          // ── QUERY ─────────────────────────────────────────────────────────
          case 'QUERY': {
            const { startDate, endDate } = resolvePeriod(intent.period);
            const periodLabel = describePeriodShort(intent.period);

            // Category mentioned but unknown → guide the user.
            if (intent.category && intent.categoryId == null) {
              outcome = {
                kind: 'prompt',
                message: `I don't have a category called ${intent.category}.`,
              };
              break;
            }

            if (intent.categoryId != null) {
              const total = await getTotalByCategory(intent.categoryId, startDate, endDate);
              outcome = {
                kind: 'query',
                message: `You spent ${speakAmount(total)} rupees on ${intent.category} ${periodLabel}.`,
              };
            } else {
              const total = await getGrandTotal(startDate, endDate);
              outcome = {
                kind: 'query',
                message: `You spent ${speakAmount(total)} rupees in total ${periodLabel}.`,
              };
            }
            break;
          }

          // ── CREATE_CATEGORY ────────────────────────────────────────────────
          case 'CREATE_CATEGORY': {
            const rawName = intent.newCategoryName?.trim();
            const rawParent = intent.newCategoryParent?.trim();

            if (!rawName || !rawParent) {
              outcome = {
                kind: 'prompt',
                message: 'To create a category, say: create category clothes under personal.',
              };
              break;
            }

            const name = titleCase(rawName);
            const parent = normalizeParent(rawParent);

            // Already exists → don't insert a duplicate; UNIQUE would throw anyway.
            const existing = await getCategoryByName(name);
            if (existing) {
              outcome = {
                kind: 'prompt',
                message: `${name} already exists under ${existing.parent ?? 'Other'}.`,
              };
              break;
            }

            await insertCategory(name, parent);
            // The parser's fuzzy matcher reads from the store — refresh it now so
            // the very next command can use the new category.
            await refreshCategories();
            outcome = {
              kind: 'created',
              message: `Created category ${name} under ${parent}.`,
            };
            break;
          }

          // ── EXPORT ─────────────────────────────────────────────────────────
          // Write CSV + summary files for the requested month, then open the
          // system share sheet. The intent period is always this_month or
          // last_month (set by the parser); anything else falls back to this.
          case 'EXPORT': {
            const isLast = intent.period === 'last_month';
            let result: ExportResult;
            try {
              result = isLast ? await exportLastMonth() : await exportCurrentMonth();
            } catch (e) {
              const m = e instanceof Error ? e.message : String(e);
              console.warn('[useVoiceCommand] export failed:', m);
              // "Storage full…" is already a complete, user-ready sentence — speak
              // it as-is. Anything else gets the generic apology wrapper.
              outcome = {
                kind: 'error',
                message: isStorageFullError(m)
                  ? m
                  : `Sorry, I could not export. ${e instanceof Error ? m : 'Please try again.'}`,
              };
              break;
            }

            const when = isLast ? 'last month' : 'this month';
            outcome =
              result.count === 0
                ? {
                    kind: 'export',
                    message: `There are no expenses for ${when}. I saved an empty ${result.monthLabel} report.`,
                  }
                : {
                    kind: 'export',
                    message: `Exported ${result.count} ${
                      result.count === 1 ? 'expense' : 'expenses'
                    } for ${result.monthLabel}. Opening the share sheet.`,
                  };

            // Speak the confirmation, then open the share sheet. Sharing is
            // best-effort — a failure to open the sheet shouldn't undo the
            // successful export, so swallow its error after logging.
            tts.speak(outcome.message);
            try {
              await shareFile(result.csvUri);
            } catch (e) {
              console.warn('[useVoiceCommand] share sheet failed:', e);
            }
            return outcome;
          }

          // ── UNKNOWN ────────────────────────────────────────────────────────
          default: {
            outcome = {
              kind: 'unknown',
              message: "I didn't understand. Try saying: gym 500 rupees paid.",
            };
            break;
          }
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        outcome = {
          kind: 'error',
          message: 'Something went wrong saving that. Please try again.',
        };
        // Surface the underlying error to the console for debugging on-device.
        console.warn('[useVoiceCommand] error handling command:', msg);
      }

      // Speak the response. Refresh the store AFTER initiating speech so the UI
      // (monthly total, expense list) reflects the new state right away.
      tts.speak(outcome.message);
      if (outcome.kind === 'added' || outcome.kind === 'created') {
        await refreshAll();
      }

      return outcome;
    },
    [refreshAll, refreshCategories, tts]
  );

  return { handleCommand };
}

// Short period label for TTS ("this month", "last month", "this week"), without
// the parenthetical month name that describePeriod() adds for the UI.
function describePeriodShort(period: ReturnType<typeof parseIntent>['period']): string {
  switch (period) {
    case 'last_month':
      return 'last month';
    case 'this_week':
      return 'this week';
    case 'last_week':
      return 'last week';
    case 'this_month':
    default:
      return 'this month';
  }
}
