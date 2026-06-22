# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

VoiceKhata is a voice-controlled, fully offline Android expense tracker. It runs on a Poco M2 Pro (Snapdragon 720G, Android 10). There is no LLM, no cloud, no internet dependency, and no paid APIs. Total cost: ₹0.

The intent parser is a **deterministic regex engine** — not an AI model. This is a deliberate architectural decision. The domain (expense tracking) is narrow enough that rule-based parsing gives testable, hallucination-free, zero-latency results.

Full design spec lives in [idea.md](idea.md). Always treat it as the canonical reference.

**Before Phase 1:** See **Phase 0** in `idea.md` — a dedicated bootstrap step that gets a placeholder screen running on the Poco M2 Pro before any real code is written. It includes prerequisites, step-by-step setup, minimum `app.json` config, and a table of common native build errors with fixes. The Phase 0 success criterion (app installs, no red screen, survives background cycle) must be met before Phase 1 starts.

---

## Commands

```bash
# Install dependencies
npm install

# Start Metro bundler
npx expo start

# Run on Android device (after prebuild)
npx expo run:android

# Generate native Android project (first time, or after new native deps)
npx expo prebuild --platform android

# Run unit tests
npm test

# Run a single test file
npx jest src/parser/intentParser.test.ts

# Run tests in watch mode
npx jest --watch

# TypeScript type check
npx tsc --noEmit

# Build release APK (local)
cd android && ./gradlew assembleRelease

# Build via EAS (cloud)
npx eas build --platform android --profile preview
```

---

## Architecture

### The Three Layers

```
Voice I/O  →  Parser  →  Data Layer
(Vosk/TTS)    (pure TS)   (SQLite)
```

These three layers are **strictly separated**. The parser (`src/parser/`) has zero imports from `src/db/` or `src/voice/`. It is pure TypeScript — testable without a device, emulator, or running app.

### Parser Pipeline (`src/parser/`)

The brain of the app. Three stages run in sequence on every voice input:

1. **`dateResolver.ts`** — runs first, before anything else. Scans text for temporal expressions ("yesterday", "3 days ago", "on 15th", "last monday"), resolves them to ISO 8601 date strings using `date-fns`, strips them from the text, and returns `{ date, period, cleaned }`. Default: today's date.

2. **`categoryMatcher.ts`** — fuzzy-matches a spoken category string against the saved categories list using Fuse.js (threshold 0.4). Three-step cascade: exact match → fuzzy match → null. Null means unknown category; the caller handles the TTS prompt.

3. **`intentParser.ts`** — takes the date-resolved, cleaned text and runs it through ordered regex patterns. Returns a `ParsedIntent` with `action`, `amount`, `category`, `date`, `period`. ADD patterns are tried first, then QUERY, CREATE_CATEGORY, EXPORT, then UNKNOWN.

**Every function in `src/parser/` is a pure function.** No side effects, no DB calls, no React hooks.

### Voice Orchestrator (`src/voice/useVoiceCommand.ts`)

The single hook that connects all three layers. Flow:

```
Vosk finalResult → parseIntent() → switch(action) → DB operation → TTS response → refresh Zustand store
```

TTS must finish speaking before the next recognition can start. Enforce this — never allow mic and TTS to run concurrently.

### Data Layer (`src/db/`)

- `database.ts` — SQLite init, `CREATE TABLE IF NOT EXISTS`, index creation, seed categories. Exports a singleton `getDb()`.
- `expenseRepository.ts` — all expense read/write. Never write raw SQL outside this file and `queries.ts`.
- `categoryRepository.ts` — all category CRUD.
- `queries.ts` — `resolvePeriod()` and `describePeriod()` for converting intent periods to date ranges and human-readable labels.

`expense_date` is stored as TEXT in ISO 8601 format (`"2026-06-21"`). This is intentional — SQLite has no DATE type, ISO strings sort lexicographically and work with `BETWEEN`.

### State (`src/store/useAppStore.ts`)

Zustand store holds: `categories[]` (for the fuzzy matcher), `recentExpenses[]`, `isModelLoaded`. Refreshed after every DB mutation. Categories are loaded from DB on app mount so the parser always has the latest list.

### Screens (`src/app/`)

Three tabs via `expo-router`:
- `index.tsx` — Home: monthly total card, MicButton, TranscriptDisplay, last 10 expenses
- `history.tsx` — All expenses, newest first
- `categories.tsx` — Categories grouped by parent, with expense counts and totals

---

## Key Constraints

- **No LLM anywhere in v1.** If parsing fails, return `UNKNOWN` and guide the user via TTS.
- **Offline-only.** No network calls, no external APIs, no analytics.
- **Memory budget:** Vosk model (~150 MB loaded) + app (~50 MB) = ~200 MB peak. Don't add heavy dependencies.
- **Target device:** Poco M2 Pro, Android 10, Snapdragon 720G. Test on this device, not just an emulator.
- **APK size target:** < 80 MB total.
- Vosk model lives at `assets/model-en-in/` and must be bundled at build time via the `react-native-vosk` Expo config plugin.

---

## Parser Pattern Rules

When adding new intent patterns to `intentParser.ts`:
- Date extraction always happens first via `dateResolver.ts` — never handle dates inside intent regex.
- Each regex pattern must have a corresponding extractor function that maps capture groups to `{ category: string, amount: number }`.
- ADD patterns are tried before QUERY patterns. More specific patterns come before more general ones.
- Test every new pattern with at least 3 test cases in `intentParser.test.ts` — one clean input, one with a date expression, one fuzzy category.

---

## Testing Standards

Parser tests (`src/parser/*.test.ts`) must mock `new Date()` to a fixed date for determinism. All temporal expression tests depend on this.

Minimum coverage targets (from `idea.md`):
- `dateResolver.test.ts`: 20+ cases
- `intentParser.test.ts`: 40+ cases
- Total: 60+ tests, all green before any phase is considered complete.

Tests are pure — no SQLite, no Vosk, no device. If a test requires a device or running app, it belongs in manual testing, not the test suite.

---

## Before Starting Any Phase — Check Implementation Notes

`idea.md` has an **"Implementation Notes / Planning Changes"** section at the bottom. It records deviations discovered during actual implementation — wrong package versions, API changes, Gradle quirks, etc. **Read this section before starting each phase.** It is the source of truth when the plan and reality diverge.

---

## After Every Implementation — Manual Testing Steps

**Claude must always end each implementation session with a clearly formatted "Manual Testing" section** listing the exact steps to:
1. Build/run the app at that phase
2. Verify the specific feature just implemented
3. Any device-specific checks (memory, crash, recognition accuracy)

This is required because voice recognition accuracy, Vosk model loading, and SQLite behavior must be verified on the actual Poco M2 Pro — not just via unit tests.

---

## Dependencies Reference

| Package | Purpose |
|---|---|
| `react-native-vosk` | Offline STT — wraps Vosk native library |
| `expo-sqlite` | SQLite database |
| `expo-speech` | TTS using Android's built-in engine |
| `expo-file-system` | Write CSV to device Documents folder |
| `expo-sharing` | Open system share sheet |
| `expo-router` | File-based tab navigation |
| `zustand` | Lightweight global state |
| `date-fns` | Date math (tree-shakeable — only import what's used) |
| `fuse.js` | Fuzzy string matching for category names |

Do not add new dependencies without checking: (a) size impact on APK, (b) whether it requires native code and thus a `prebuild`, (c) whether it works offline.
