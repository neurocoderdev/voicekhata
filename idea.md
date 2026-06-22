# VoiceKhata — Voice-Powered Local Expense Tracker
## Implementation Plan

> **Constraints (entire project):** Free, open-source, fully offline, runs on Poco M2 Pro
> (Snapdragon 720G, 4–6 GB RAM, Android 10). No paid APIs. No cloud dependencies.
> No LLM in v1. Everything runs on-device. Total cost: ₹0.

---

## What We Are Building

A voice-controlled personal expense tracker Android app that:
1. Accepts voice commands via an always-local speech-to-text engine (Vosk)
2. Parses the spoken text using a rule-based regex intent parser — extracts action, amount, category, and date
3. Resolves relative date expressions ("yesterday", "3 days ago", "on 15th") to actual calendar dates
4. Fuzzy-matches spoken category names against the user's saved categories (handles Vosk misrecognitions)
5. Stores every expense in a local SQLite database with full date, category, and amount indexing
6. Answers spending queries by voice ("how much spent on gym this month") with TTS-spoken responses
7. Exports monthly expense data as CSV files to device storage, shareable via any app

**No LLM, no cloud, no internet.** The intent parser is a deterministic regex engine. This is the
deliberate design choice — a narrow domain (expense tracking) does not need a language model.
Rule-based parsing gives us testable, instant, hallucination-free results on a ₹12,000 phone.

---

## Target Device Profile

| Spec | Poco M2 Pro |
|---|---|
| SoC | Qualcomm Snapdragon 720G (8 nm) |
| CPU | 2× 2.3 GHz Cortex-A76 + 6× 1.8 GHz Cortex-A55 |
| RAM | 4 GB / 6 GB LPDDR4X |
| Storage | 64 GB / 128 GB |
| OS | Android 10 (MIUI) |
| Battery | 5000 mAh |

**Memory budget:** Vosk small model (~150 MB loaded) + App (~50 MB) + SQLite (~negligible)
= ~200 MB peak. Leaves 3.5+ GB free for the OS. Comfortable margin.

---

## Tech Stack (Fixed for v1)

| Layer | Technology | Why this one | Size/Cost |
|---|---|---|---|
| Framework | React Native + Expo (dev build) | Developer knows React/RN. Expo manages native config. | Free |
| Language | TypeScript | Type safety. Familiar from web background. | Free |
| STT Engine | `react-native-vosk` | Only mature offline STT library for RN. Has Expo config plugin. | Free |
| Vosk Model | `vosk-model-small-en-in-0.4` | Indian English. Small enough for Poco M2 Pro. | ~50 MB, Free |
| Intent Parser | Custom regex engine (TypeScript) | Deterministic. Testable. No LLM needed for narrow domain. | Free |
| Fuzzy Matching | `fuse.js` | Category name matching against Vosk misrecognitions. 7 KB. | Free |
| Date Math | `date-fns` | Tree-shakeable. Only import what's used. ~5 KB. | Free |
| Database | `expo-sqlite` | SQLite wrapper for Expo. Synchronous API. No native build hassle. | Free |
| TTS | `expo-speech` | Uses Android's built-in TTS engine. Zero extra dependencies. | Free |
| File Export | `expo-file-system` | Write CSV to device Documents folder. | Free |
| File Sharing | `expo-sharing` | Share exported CSV via WhatsApp, email, etc. | Free |
| Navigation | `expo-router` | File-based routing. Simple. | Free |
| State | `zustand` | 1 KB. No boilerplate. Better than Context for this scale. | Free |
| **Total** | | | **₹0, ~80 MB APK** |

### What We Are NOT Using in v1 and Why

| Skipped | Reason |
|---|---|
| Gemini Nano / any LLM | Poco M2 Pro hardware cannot run it. Planned for v2 on supported devices. |
| Charts / visualization library | v1 uses text summaries only. Visual reports planned for v2. |
| Redux / MobX | Overkill for this app's state complexity. Zustand is sufficient. |
| Room / Hilt / Jetpack Compose | We chose React Native, not native Kotlin. |
| Cloud backup | Offline-only constraint in v1. Optional Google Drive backup in v3. |
| i18n / Hindi support | English only in v1. Hindi + code-switching in v2. |
| expo-av / audio recording library | Vosk handles microphone capture internally via its native layer. |

---

## Data Model

### SQLite Schema (3 tables)

**categories**
- `id` — INTEGER, primary key, autoincrement
- `name` — TEXT, not null, unique (e.g. "Gym", "Grocery", "Rent")
- `parent` — TEXT, nullable (e.g. "Personal", "Household")
- `created_at` — TEXT, default `datetime('now')`

**expenses**
- `id` — INTEGER, primary key, autoincrement
- `amount` — REAL, not null
- `category_id` — INTEGER, not null, foreign key → `categories.id`
- `expense_date` — TEXT, not null, ISO 8601 format ("2026-06-21")
- `note` — TEXT, nullable (short description: "gym 500 paid")
- `raw_voice` — TEXT, nullable (original Vosk transcription, for audit/debugging)
- `created_at` — TEXT, default `datetime('now')`
- Index on `(category_id, expense_date)` — covers the most common query pattern

**settings**
- `key` — TEXT, primary key
- `value` — TEXT

### Why `expense_date` Is TEXT

SQLite has no native DATE type. ISO 8601 strings ("2026-06-21") sort lexicographically,
work with `BETWEEN` for range queries, read naturally in CSV exports, and require no
conversion logic. This is the standard SQLite pattern.

### Seed Categories (inserted on first launch)

```
Personal    → Gym, Entertainment, Shopping, Health, Education
Household   → Grocery, Electricity, Water, Gas, Rent, Maintenance
Transport   → Auto, Bus, Fuel, Parking
Food        → Restaurant, Snacks, Tea/Coffee
Bills       → Mobile, Internet, Insurance, Subscriptions
Other       → (catch-all for uncategorized expenses)
```

User can add more via voice: "create category clothes under personal."

---

## The Three Core Entities the Parser Extracts

Every voice command is parsed into a structured intent with these fields:

- **action** — `ADD` | `QUERY` | `CREATE_CATEGORY` | `UNKNOWN`
- **amount** — number or null
- **category** — string or null (fuzzy-matched against saved categories)
- **date** — ISO string, **never null** (defaults to today if user doesn't mention a date)
- **period** — for QUERY intents: `this_month` | `last_month` | `this_week` | null

**Date is a first-class entity, equally important as category.**
If the user says nothing about when, the date is today. If they say "yesterday" or
"3 days ago" or "on 15th", it resolves to the actual calendar date before anything else runs.

---

## Date Resolver — Supported Expressions

The date resolver runs BEFORE intent matching. It scans the transcribed text for temporal
expressions, resolves them to ISO date strings, and strips them from the text so they don't
interfere with category matching.

| User says | Resolves to |
|---|---|
| *(nothing about date)* | today's date (device clock) |
| "today" | today's date |
| "yesterday" | today − 1 day |
| "day before yesterday" | today − 2 days |
| "3 days ago" / "three days ago" | today − N days (supports words and digits) |
| "5 days back" | today − N days |
| "last monday" / "last friday" | most recent past occurrence of that weekday |
| "on 15th" / "on the 15th" | 15th of current month (if future, assumes last month) |
| "june 10" / "10 june" | specific month + day, current year |
| "this month" (queries) | period: 1st of month → today |
| "last month" (queries) | period: full previous month |
| "this week" (queries) | period: Monday → today |

---

## Intent Parser — Supported Patterns

### ADD Patterns (expense entry)

| Pattern | Example |
|---|---|
| `{category} {amount} [rupees/rs] {paid/spent/done}` | "gym 500 rupees paid" |
| `{spent/paid} {amount} [rupees/rs] {on/for} {category}` | "spent 1000 on groceries" |
| `{add/log} {amount} [rupees/rs] {to/in/for} {category}` | "add 200 to electricity" |
| `{category} {amount}` (no verb, just noun + number) | "groceries 800" |
| `{amount} [rupees/rs] {category}` | "1000 rupees gym" |
| `{spent/paid} {amount} {category}` (no preposition) | "spent 300 auto" |

All ADD patterns can have any date expression appended: "gym 500 paid **yesterday**",
"spent 200 on auto **3 days ago**", "add 500 to electricity **on 15th**".

### QUERY Patterns (spending queries)

| Pattern | Example |
|---|---|
| `how much spent on {category} [this/last month]` | "how much spent on gym this month" |
| `total {category} [last month]` | "total groceries last month" |
| `what was my bill [last month]` | "what was my bill last month" (all categories) |
| `show expenses / list spending` | "show expenses" (all, current month) |
| `{category} spending / {category} expenses` | "gym spending" |

### CREATE CATEGORY Pattern

| Pattern | Example |
|---|---|
| `create category {name} under {parent}` | "create category clothes under personal" |

### EXPORT Pattern

| Pattern | Example |
|---|---|
| `export [this/last] month` | "export this month" |

### UNKNOWN

Anything that doesn't match → TTS responds: "I didn't understand. Try saying: gym 500 rupees paid."

---

## Category Matcher — Fuzzy Matching

Vosk transcriptions are imperfect. Common misrecognitions:
- "grosory" → should match "Grocery"
- "jim" → should match "Gym"
- "electrisity" → should match "Electricity"

The matcher uses Fuse.js with threshold 0.4 (0 = exact, 1 = match anything).
Three-step cascade:
1. Exact match (case-insensitive) → instant return
2. Fuzzy match (Fuse.js, threshold 0.4) → return if confident
3. No match → TTS asks: "I don't have a category called {X}. Say 'create category {X} under personal' to add it."

---

## Device Folder Structure (Exported Files)

```
Internal Storage/Documents/VoiceKhata/
├── 2026/
│   ├── 06-June/
│   │   ├── expenses.csv         # Date, Category, Amount, Note
│   │   └── summary.txt          # Category-wise totals + grand total
│   └── 05-May/
│       ├── expenses.csv
│       └── summary.txt
└── categories.json              # Exported category config (for backup)
```

---

## Project Structure

```
voicekhata/
├── app.json                          # Expo config + react-native-vosk plugin
├── eas.json                          # EAS Build config
├── tsconfig.json
├── package.json
├── assets/
│   └── model-en-in/                  # Vosk Indian English model (~50 MB)
├── src/
│   ├── app/                          # Expo Router screens
│   │   ├── _layout.tsx               # Root layout (tab navigator)
│   │   ├── index.tsx                 # Home screen (voice command hub)
│   │   ├── history.tsx               # Transaction history list
│   │   └── categories.tsx            # Category management
│   │
│   ├── parser/                       # The brain — pure business logic, no UI
│   │   ├── intentParser.ts           # Main parser: regex patterns + orchestration
│   │   ├── dateResolver.ts           # Temporal expression → ISO date string
│   │   ├── categoryMatcher.ts        # Fuzzy match spoken name → saved category
│   │   ├── intentParser.test.ts      # 60+ unit tests for parser
│   │   └── dateResolver.test.ts      # Date resolution tests
│   │
│   ├── db/                           # Data layer
│   │   ├── database.ts               # SQLite init, migrations, seed categories
│   │   ├── expenseRepository.ts      # Insert, query, aggregate expenses
│   │   ├── categoryRepository.ts     # CRUD for categories
│   │   └── queries.ts                # Complex query builders (monthly summary, etc.)
│   │
│   ├── voice/                        # Voice I/O hooks
│   │   ├── useSpeechRecognition.ts   # Hook wrapping react-native-vosk
│   │   ├── useTts.ts                 # Hook wrapping expo-speech
│   │   └── useVoiceCommand.ts        # Orchestrator: STT → Parser → DB → TTS
│   │
│   ├── export/                       # File export
│   │   └── csvExporter.ts            # Write CSV + summary to Documents folder
│   │
│   ├── store/                        # State management
│   │   └── useAppStore.ts            # Zustand store (categories cache, recent expenses)
│   │
│   ├── components/                   # Shared UI components
│   │   ├── MicButton.tsx             # Large animated mic button
│   │   ├── TranscriptDisplay.tsx     # Live transcription text
│   │   ├── ExpenseCard.tsx           # Single expense item in lists
│   │   └── CategoryChip.tsx          # Category tag/pill
│   │
│   └── utils/
│       ├── constants.ts              # Seed category definitions, config values
│       └── formatters.ts             # Currency formatting, date display helpers
│
└── __tests__/                        # Test files (co-located tests also in src/parser/)
```

---

## Implementation Phases (v1.0)

---

### Phase 0 — Bootstrap: Clean Native Build Running on Device
**Goal:** A placeholder screen ("Hello VoiceKhata") installs and runs on the Poco M2 Pro
without any errors. No real features. Just a clean, working native build confirmed on the
actual device. This is the hardest step — do it before writing any real code.

#### Prerequisites (verify before starting)

```bash
node --version        # Must be 18+
java -version         # Must be JDK 17 (not 21, not 11 — Gradle targets work best with 17)
echo $ANDROID_HOME    # Must be set: e.g. /home/<user>/Android/Sdk
adb devices           # Poco M2 Pro must appear as "<serial>  device" (NOT "unauthorized")
```

If `adb devices` shows `unauthorized`: on the Poco M2 Pro, tap "Always allow USB debugging from this computer".

#### Steps

```bash
# 1. Create Expo project (TypeScript blank template)
npx create-expo-app voicekhata --template blank-typescript
cd voicekhata

# 2. Install ALL v1 dependencies in one shot
npm install expo-sqlite expo-speech expo-file-system expo-sharing expo-router \
  zustand date-fns fuse.js react-native-vosk

# 3. Let Expo fix any peer dep mismatches
npx expo install --fix

# 4. Configure app.json (see minimum config below)

# 5. Create a placeholder Vosk model folder (real model comes in Phase 3)
mkdir -p assets/model-en-in && touch assets/model-en-in/.gitkeep

# 6. Generate the native Android project
npx expo prebuild --platform android --clean

# 7. Verify the Gradle build compiles
cd android && ./gradlew assembleDebug && cd ..

# 8. Run on device
npx expo run:android
```

#### Minimum app.json for Phase 0

```json
{
  "expo": {
    "name": "VoiceKhata",
    "slug": "voicekhata",
    "scheme": "voicekhata",
    "version": "1.0.0",
    "orientation": "portrait",
    "platforms": ["android"],
    "android": {
      "package": "com.voicekhata.app",
      "permissions": ["RECORD_AUDIO"]
    },
    "plugins": [
      "expo-router",
      ["react-native-vosk", { "model": "assets/model-en-in" }]
    ]
  }
}
```

#### Common errors and fixes

| Error | Fix |
|---|---|
| `SDK location not found` | Create `android/local.properties`: `sdk.dir=/path/to/Android/Sdk` |
| `error: package X does not exist` after prebuild | `npx expo install --fix` → `npx expo prebuild --platform android --clean` |
| `adb: device unauthorized` | Tap "Allow USB debugging" on Poco M2 Pro |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | `adb uninstall com.voicekhata.app` then retry |
| `react-native-vosk` build error (model path) | The placeholder `.gitkeep` in `assets/model-en-in/` is enough for Phase 0 |
| Metro bundler port conflict | `npx expo start --port 8082` |
| Gradle sync fails (first time only) | Needs internet for initial Gradle/dependency download — fully offline after that |

#### Phase 0 success criteria

- `npx expo run:android` completes without errors
- App installs on Poco M2 Pro
- Any screen appears (placeholder text is fine)
- No red error screen on launch
- App survives a background → foreground cycle

**Only after Phase 0 is verified should Phase 1 begin.**

---

### Phase 1 — Project Scaffold, Database & Seed Data
**Goal:** App launches on Poco M2 Pro. SQLite initializes. Categories are seeded. Expenses
can be inserted and queried via code. A debug screen proves the data layer works.

- Initialize Expo project with TypeScript blank template
- Install all v1 dependencies: `expo-sqlite`, `expo-speech`, `expo-file-system`,
  `expo-sharing`, `expo-router`, `zustand`, `date-fns`, `fuse.js`, `react-native-vosk`
- Configure `app.json` with Expo Router plugin and react-native-vosk plugin
  (model path: `assets/model-en-in`)
- Download Vosk model `vosk-model-small-en-in-0.4` (~50 MB) from alphacephei.com,
  unzip into `assets/model-en-in/`
- Generate native Android project: `npx expo prebuild --platform android`
- Create `src/db/database.ts`:
  - Open or create SQLite database on app launch
  - Run `CREATE TABLE IF NOT EXISTS` for all 3 tables (categories, expenses, settings)
  - Create index on `expenses(category_id, expense_date)`
  - Check if categories table is empty → seed ~25 default categories with parents
  - Export a singleton `getDb()` function
- Create `src/db/categoryRepository.ts`:
  - `getAllCategories()` — returns all categories with parent grouping
  - `getCategoryByName(name)` — exact lookup
  - `insertCategory(name, parent)` — for user-created categories
  - `deleteCategory(id)` — only for non-seed categories
- Create `src/db/expenseRepository.ts`:
  - `insertExpense({ amount, categoryId, expenseDate, note, rawVoice })`
  - `getRecentExpenses(limit: number)` — latest N expenses, joined with category name
  - `getExpensesByDateRange(startDate, endDate)` — for export and history
  - `getTotalByCategory(categoryId, startDate, endDate)` — SUM query for a category
  - `getGrandTotal(startDate, endDate)` — SUM across all categories
  - `getMonthlySummary(startDate, endDate)` — grouped by category, sorted by total desc
- Create `src/db/queries.ts`:
  - `resolvePeriod(period)` — converts "this_month" / "last_month" / "this_week" to
    `{ startDate, endDate }` ISO strings
  - `describePeriod(period)` — returns human-readable string for TTS
    ("this month", "in May", "this week")
- Create a temporary debug screen (`app/index.tsx`):
  - Display list of all seeded categories grouped by parent
  - Button to insert a test expense (hardcoded values)
  - Display last 10 expenses in a FlatList
  - Button to run `getTotalByCategory` and show the result
  - This screen is throwaway — it validates the data layer before voice is added
- Create `src/store/useAppStore.ts` (Zustand):
  - State: `categories[]`, `recentExpenses[]`, `isModelLoaded`
  - Actions: `refreshCategories()`, `refreshExpenses()`, `setModelLoaded()`
  - Initialize by loading categories from DB on app mount

**Deliverable:** App compiles, runs on Poco M2 Pro via `npx expo run:android`.
Debug screen shows 25+ seeded categories. Test expenses can be inserted and queried.
`getTotalByCategory` returns correct sums.

---

### Phase 2 — Intent Parser, Date Resolver & Test Suite
**Goal:** The TypeScript parser module takes a raw string like "gym 500 rupees paid yesterday"
and returns a fully structured intent with resolved date, matched action, amount, and category.
100% testable without any voice, UI, or device dependency — pure functions in, structured data out.

- Create `src/parser/dateResolver.ts`:
  - Pure function: `resolveDate(text: string) → { date: string, period: Period | null, cleaned: string }`
  - Implements all temporal expressions from the Date Resolver spec above
  - Handles word numbers ("three days ago") via a lookup map
  - Handles day names ("last monday") via date-fns `previousDay`
  - Handles "on 15th" with smart month resolution (if date is future, use previous month)
  - Strips matched temporal phrases from text, returns `cleaned` string
  - Default: if no temporal expression found, returns today's date from device clock
- Create `src/parser/categoryMatcher.ts`:
  - `matchCategory(spoken: string, categories: Category[]) → Category | null`
  - Three-step cascade: exact match → Fuse.js fuzzy (threshold 0.4) → null
  - Null means "unknown category" — caller decides how to handle
- Create `src/parser/intentParser.ts`:
  - `parseIntent(rawText: string, categories: Category[]) → ParsedIntent`
  - Three-stage pipeline: dateResolver → regex intent matching → categoryMatcher
  - Implements all ADD, QUERY, CREATE_CATEGORY, EXPORT, and UNKNOWN patterns
    from the Intent Parser spec above
  - Each regex pattern has an extract function that maps capture groups to
    `{ category, amount }` — order of groups varies per pattern
  - ADD patterns tried first, then QUERY, then CREATE, then EXPORT
  - If nothing matches → returns `action: 'UNKNOWN'`
- Create `src/parser/dateResolver.test.ts` — minimum 20 test cases:
  - No date mentioned → today's date
  - "yesterday" → today − 1
  - "day before yesterday" → today − 2
  - "3 days ago" → today − 3
  - "three days ago" → today − 3 (word number)
  - "last monday" → most recent Monday
  - "on 15th" → 15th of current month (or last month if future)
  - "on the 5th" → 5th of current month
  - "this month" → period: `this_month`, date: today
  - "last month" → period: `last_month`, date: today
  - Date phrase is stripped from cleaned text
  - Multiple edge cases: "on 31st" for months with 30 days, etc.
  - All tests mock `new Date()` to a fixed date for determinism
- Create `src/parser/intentParser.test.ts` — minimum 40 test cases:
  - ADD intents — every pattern variant:
    - "gym 500 rupees paid" → ADD, gym, 500, today
    - "gym 500 paid yesterday" → ADD, gym, 500, yesterday's date
    - "spent 1000 on groceries" → ADD, grocery, 1000, today
    - "spent 200 on auto 3 days ago" → ADD, auto, 200, today−3
    - "add 500 to electricity" → ADD, electricity, 500, today
    - "paid rent 15000 on 1st" → ADD, rent, 15000, 1st
    - "1000 rupees gym" → ADD, gym, 1000, today
    - "groceries 800" → ADD, grocery, 800, today
    - "spent 300 auto" → ADD, auto, 300, today
  - QUERY intents:
    - "how much spent on gym this month" → QUERY, gym, this_month
    - "total groceries last month" → QUERY, grocery, last_month
    - "what was my bill last month" → QUERY, null (all), last_month
    - "show expenses" → QUERY, null, this_month
    - "gym spending" → QUERY, gym, this_month
  - CREATE intents:
    - "create category clothes under personal" → CREATE_CATEGORY, clothes, personal
  - EXPORT intents:
    - "export this month" → EXPORT, this_month
  - UNKNOWN intents:
    - "hello" → UNKNOWN
    - "what is the weather" → UNKNOWN
    - "500" alone (no category) → UNKNOWN
  - Fuzzy matching edge cases:
    - "grosory 500 paid" → ADD, grocery (fuzzy), 500
    - "jim 300 paid" → ADD, gym (fuzzy), 300
  - Amount edge cases:
    - Very large: "rent 50000 paid" → 50000
    - Small: "tea 10 paid" → 10
- Configure Jest or Vitest for running tests
- Verify all tests pass with `npm test`

**Deliverable:** Parser module with 60+ passing tests. `npm test` is green. No voice,
no UI, no device dependency — pure TypeScript logic verified in isolation.

---

### Phase 3 — Voice Engine (Vosk STT + TTS)
**Goal:** Tap a mic button, speak, see the live transcription appear on screen. TTS can
speak a response. No intent parsing wired yet — just raw voice I/O working reliably
on Poco M2 Pro.

- Create `src/voice/useSpeechRecognition.ts` — custom React hook:
  - `loadModel()` — loads Vosk model from assets (called once on app startup)
  - `startListening()` — begins recording + recognition
  - `stopListening()` — manually stops recognition
  - Exposes state: `isListening`, `partialResult` (live), `finalResult`, `error`, `isModelLoaded`
  - Subscribes to Vosk partial result events for live transcript display
  - Handles microphone permission request (via Vosk's built-in prompt)
  - Handles errors gracefully: model load failure, permission denied, recognition error
  - Model stays loaded in memory after first load (no reload per recognition)
- Create `src/voice/useTts.ts` — custom React hook:
  - `speak(text)` — speaks the given text using expo-speech with Indian English locale
  - `stop()` — stops any in-progress speech
  - Configured with `language: 'en-IN'`, `rate: 0.95`, `pitch: 1.0`
- Create `src/components/MicButton.tsx`:
  - Large circular button (80×80 dp minimum for comfortable tap target)
  - Idle state: mic icon, neutral color
  - Listening state: pulsing animation (scale or ring pulse), accent color
  - Disabled state: while model is loading (show loading spinner)
  - Press to start, press again to stop
- Create `src/components/TranscriptDisplay.tsx`:
  - Shows partial result (gray, updating live while speaking)
  - Shows final result (primary color, after recognition completes)
  - Shows status messages ("Loading model...", "Listening...", "Processing...")
- Build a test screen that shows just the mic button + transcript:
  - On launch: show "Loading model..." while Vosk loads (2–4 seconds)
  - After load: show mic button
  - Tap mic → speak → see partial transcript streaming → final result appears
  - Below transcript: a button that calls `tts.speak(finalResult)` to echo it back
- Device testing on Poco M2 Pro — verify:
  - Model loads in < 5 seconds
  - "gym 500 rupees paid" recognized correctly ≥ 8/10 times
  - "how much spent on groceries this month" recognized correctly
  - Partial results stream in while speaking (not just at the end)
  - Memory stays under 250 MB during recognition (check with `adb shell dumpsys meminfo`)
  - No crash after 20 consecutive recognitions
  - Recognition works in quiet room and moderately noisy room
  - Works with Indian English accent specifically

**Deliverable:** Working voice I/O on Poco M2 Pro. Tap mic → speak → see transcript → hear TTS echo.
Vosk model loads once, stays loaded, handles 20+ consecutive recognitions without crash.

---

### Phase 4 — Wire the Full Pipeline (Voice → Parse → DB → TTS)
**Goal:** Speak a command, it gets parsed, the expense is saved (or query answered), and TTS
confirms. This is where all modules connect. The app becomes functionally complete.

- Create `src/voice/useVoiceCommand.ts` — the orchestrator hook:
  - When `finalResult` is received from Vosk:
    1. Call `parseIntent(finalResult, categories)` from the parser module
    2. Switch on `intent.action`:
       - **ADD**: validate amount > 0 and categoryId exists → `insertExpense()` →
         `getTotalByCategory()` for running total → TTS: "Added {amount} rupees to
         {category} for {dateLabel}. Total this month: {total} rupees."
       - **QUERY**: `resolvePeriod(intent.period)` → `getTotalByCategory()` or
         `getGrandTotal()` → TTS: "You spent {total} rupees on {category} {periodLabel}."
       - **CREATE_CATEGORY**: `insertCategory(name, parent)` → refresh store →
         TTS: "Created category {name} under {parent}."
       - **EXPORT**: call CSV exporter → TTS: "Exported {month} expenses. {count} transactions."
       - **UNKNOWN**: TTS: "I didn't understand. Try saying: gym 500 rupees paid."
    3. Refresh the expenses list in Zustand store
  - Handle edge cases:
    - Unknown category (categoryId is null but category string exists) → TTS prompts
      user to create it: "I don't have a category called {X}. Say 'create category {X}
      under personal' to add it."
    - Amount is missing → TTS: "I heard the category but not the amount. Please try again."
    - Vosk returns empty string → TTS: "I didn't catch that. Please try again."
    - TTS must finish speaking BEFORE next recognition can start (prevent overlap)
- Build the **Home Screen** (`app/index.tsx`) — replace the debug screen:
  - Top: monthly summary card — "June 2026 — ₹{total} spent" (queries grand total on mount)
  - Center: MicButton component (large, prominent)
  - Below mic: TranscriptDisplay (shows live partial → final → status message)
  - Below transcript: scrollable list of last 10 expenses (ExpenseCard components)
  - Each ExpenseCard shows: date (formatted), category name, amount (₹), note
  - Pull-to-refresh on the expense list
- Build the **History Screen** (`app/history.tsx`):
  - FlatList of ALL expenses, newest first
  - Each item: date, category with parent label, amount, note
  - Pull-to-refresh
  - No pagination needed in v1 — SQLite handles thousands of rows
  - Empty state: "No expenses yet. Go to home and tap the mic."
- Build the **Categories Screen** (`app/categories.tsx`):
  - List of all categories, grouped by parent (section headers)
  - Each category shows: name, number of expenses, total amount
  - "Add Category" button at bottom (simple text inputs for name + parent, not voice)
  - Swipe-to-delete on user-created categories (not on seed categories)
  - Deleting a category with expenses → show warning, require confirmation
- Set up `expo-router` tab navigator in `app/_layout.tsx`:
  - Three tabs: Home (mic icon), History (list icon), Categories (tag icon)
  - Bottom tab bar with icons and labels
- End-to-end testing on Poco M2 Pro — verify:
  - "gym 500 rupees paid" → expense appears in list → TTS confirms with total
  - "spent 1000 on groceries yesterday" → expense_date is yesterday in DB
  - "how much spent on gym this month" → TTS speaks correct total
  - "what was my bill last month" → TTS speaks correct grand total for previous month
  - Unknown category → TTS prompts to create → "create category X under Y" → works
  - "show expenses" → TTS speaks summary or last few expenses
  - History screen shows all expenses in correct order
  - Categories screen shows correct counts and totals
  - 10 rapid-fire voice commands don't crash the app

**Deliverable:** Complete voice-to-database loop working end-to-end. All three screens
functional. Every voice command gets a spoken response. The app is usable for daily expense tracking.

---

### Phase 5 — CSV Export & File System
**Goal:** Export monthly expenses as CSV files to device storage. Files are openable in
Google Sheets and shareable via WhatsApp, email, or any app.

- Create `src/export/csvExporter.ts`:
  - `exportMonth(year, month)` — the main export function:
    - Computes date range for the given month
    - Queries all expenses in that range (joined with category names)
    - Builds CSV string: header row ("Date,Category,Amount,Note") + data rows
    - Creates directory structure: `Documents/VoiceKhata/{year}/{MM-MonthName}/`
    - Writes `expenses.csv` to that directory
    - Writes `summary.txt` — category-wise totals + grand total, human-readable
    - Returns the file path for sharing
  - `shareFile(filePath)` — opens the system share sheet via `expo-sharing`
  - `exportCategories()` — exports `categories.json` backup file
  - Handle edge cases:
    - Empty month (no expenses) → export CSV with header only, summary says "No expenses"
    - Very long notes → escape commas and quotes properly in CSV
    - Storage full → catch write error, show user-friendly message
- Add EXPORT pattern to the intent parser (if not already done):
  - "export this month" → triggers `exportMonth` for current month
  - "export last month" → triggers `exportMonth` for previous month
- Add export button to Home Screen header:
  - Small export/share icon in top-right
  - Taps → exports current month → opens share sheet
- Add auto-export check on app launch:
  - On app start, check if previous month's CSV exists
  - If not, and if there are expenses for that month, auto-export
  - Show a brief toast/banner: "May expenses auto-exported."
- Testing:
  - Export creates file at correct directory path
  - CSV opens correctly in Google Sheets (test by sharing to self)
  - Summary.txt has correct category totals matching DB queries
  - Share sheet opens and can send via WhatsApp
  - "export this month" voice command triggers export + TTS confirmation
  - Empty month exports gracefully (no crash)
  - Verify file paths work on MIUI (Poco M2 Pro's OS)

**Deliverable:** CSV + summary files export correctly. Share sheet works. Voice command
"export this month" produces files and confirms via TTS. Files open in Google Sheets.

---

### Phase 6 — Error Handling, Polish & Build APK
**Goal:** Handle all edge cases. Make the app feel solid on Poco M2 Pro. Build a signed
APK that can be installed and used daily.

- **Error handling sweep:**
  - Vosk model fails to load → show error screen with retry button (not a crash)
  - Microphone permission denied → explain screen with "Open Settings" button
  - Database corruption → detect via try-catch on init, recreate + re-seed categories
  - Storage full on export → catch error, TTS: "Storage full. Free some space and try again."
  - App backgrounded while listening → stop recognition cleanly, reset state
  - TTS speaks while mic is about to listen → enforce sequential: TTS finishes → then mic starts
  - App killed mid-recognition → no data corruption (SQLite is transactional)
- **UI polish:**
  - Loading screen while Vosk model initializes (2–4 seconds, show app logo + spinner)
  - Haptic feedback on mic button press (expo-haptics if available, or Vibration API)
  - Expense cards show a colored dot per parent category (consistent color mapping)
  - Monthly total card at top of home screen updates after every command
  - Empty states on all screens ("No expenses yet", "No categories match")
  - Consistent spacing, typography, and colors (pick 2 font sizes, 3 colors, stick to them)
  - Status bar properly styled on MIUI
- **Performance verification on Poco M2 Pro:**
  - Cold start time target: < 6 seconds (including Vosk model load)
  - Voice command end-to-end target: < 3 seconds (speak → TTS confirmation)
  - Vosk model stays loaded — no reload between commands
  - Database queries with 500+ expenses: no perceptible lag
  - FlatList in history screen: smooth scroll with 500+ items
  - Memory during active use: < 300 MB total app footprint
  - Battery: 30 minutes of active voice use should consume < 5% battery
- **Build the APK:**
  - Option A (local build): `cd android && ./gradlew assembleRelease`
  - Option B (EAS): `npx eas build --platform android --profile preview`
  - Target APK size: < 80 MB (app ~15 MB + Vosk model ~50 MB + RN runtime ~10 MB)
  - Test install on Poco M2 Pro via `adb install`
  - Verify app works fully offline (airplane mode)
- **Final acceptance testing:**
  - [ ] 20 consecutive voice commands without crash
  - [ ] Background/foreground cycle doesn't break state or lose data
  - [ ] Back button behavior correct on all screens
  - [ ] Orientation change doesn't lose data (lock to portrait if needed)
  - [ ] Full workflow: add 5 expenses by voice → query totals → export CSV → share file
  - [ ] Works in airplane mode from app launch to CSV export

**Deliverable:** Signed APK installed on Poco M2 Pro. App is stable, polished, and ready for
daily personal use. All edge cases handled gracefully. No crashes in normal usage.

---

## Voice Command Reference Card (v1.0 — Complete)

### Adding expenses
```
"gym 500 rupees paid"
"gym 500 paid yesterday"
"spent 1000 on groceries"
"spent 200 on auto 3 days ago"
"add 500 to electricity"
"paid rent 15000 on 1st"
"1000 rupees gym"
"groceries 800"
"bus 30 rs day before yesterday"
```

### Querying spending
```
"how much spent on gym"
"how much spent on gym this month"
"total groceries last month"
"what was my bill last month"
"show expenses"
"gym spending"
```

### Managing categories
```
"create category clothes under personal"
"create category petrol under transport"
```

### Exporting data
```
"export this month"
"export last month"
```

---

## Success Criteria (v1.0)

| Metric | Target |
|---|---|
| Voice-to-DB end-to-end latency | < 3 seconds on Poco M2 Pro |
| Vosk recognition accuracy (Indian English, quiet room) | ≥ 80% for expense commands |
| Parser unit tests passing | 60+ tests, all green |
| Date resolver correctness | All 10+ temporal expressions resolve accurately |
| Fuzzy category matching | Catches common Vosk misrecognitions (grosory→grocery) |
| Query accuracy | Correct totals for category + month combinations |
| CSV export | Opens correctly in Google Sheets |
| Stability | 20 consecutive commands, zero crashes |
| Offline operation | 100% — works in airplane mode |
| APK size | < 80 MB |
| Total cost | ₹0 |

---

## Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Vosk accuracy too low for Indian English | High | Test in Phase 3. Fallback: try larger model (~200 MB). Worst case: switch to Sherpa-ONNX (more work but better accuracy). |
| `react-native-vosk` has bugs or is unmaintained | Medium | Library is a thin native bridge (~500 lines). If broken, fork and fix. Fallback: use Android's built-in SpeechRecognizer API (requires online, but works as backup). |
| MIUI restricts file access for CSV export | Medium | Use `expo-file-system` documentDirectory (always accessible on all Android). Test on actual Poco device in Phase 5. |
| User speaks commands not covered by regex patterns | Medium | UNKNOWN → TTS guides user to rephrase. Track raw_voice for unmatched commands. Add new patterns in patches based on real usage. |
| Expo dev build takes too long / fails | Low | First build ~15 min, subsequent ~2 min. If EAS fails, local build via Android Studio. |
| 50 MB Vosk model makes APK too large | Low | 80 MB is acceptable for an offline app. Alternative: download model on first launch instead of bundling. |

---

## v2.0 — "Smarter" (Future, Not Phased)

**Target devices:** Pixel 8+ / Samsung S24+ (Gemini Nano support required)

- **Gemini Nano fallback:** When the rule-based parser returns UNKNOWN, route the transcription to Gemini Nano (on-device, free via Google AICore) for intent extraction. Still fully offline.
- **Hindi + English code-switching:** Add Hindi Vosk model, detect language from transcript, handle mixed commands like "grocery ka total batao this month."
- **Visual reports screen:** Monthly bar chart (spending by category), category pie chart, trend line. Use a lightweight charting library (Victory Native or react-native-chart-kit).
- **Smarter query understanding:** "Which category did I spend the most on?" / "Compare gym and grocery this month" / "Am I spending more than last month?"
- **Edit/delete expenses by voice:** "Delete the last expense" / "Change yesterday's gym to 600."
- **Confirmation step for large amounts:** If amount > ₹5000, TTS asks "Did you say 15000 rupees for rent? Say yes to confirm."

---

## v3.0 — "Polished" (Future, Not Phased)

- **Wake word detection:** "Hey Khata" triggers listening without touching the phone. Use Porcupine (free tier, 3 wake words) or sherpa-onnx keyword spotting.
- **Budget alerts:** Set monthly budgets per category. TTS warns: "You've used 80% of your grocery budget." Alert when a category exceeds limit.
- **Recurring expense templates:** "Add gym 500 every month on 5th" → auto-logs on the 5th.
- **Home screen widget:** Quick voice entry from Android home screen without opening the app.
- **Cloud backup (optional):** Manual export to Google Drive. User-initiated, never automatic. Keeps offline-first principle.
- **Dark mode + Material You theming:** Follow system theme on Android 12+.
- **Multi-device sync:** Optional, via a self-hosted sync server or peer-to-peer local network sync.

---

## Implementation Notes / Planning Changes

Changes or deviations from the plan discovered during actual implementation.

### Phase 0

- **`react-native-vosk` version:** Plan referenced v0.2.x which doesn't exist on npm. Actual published version is `2.1.7`. Plugin API also changed — v2.x uses `{ "models": [] }` (array) not `{ "model": "path" }` (string) in `app.json`.

- **`expo-router` version:** Plan said `~4.0.17` but that targets SDK 52. With Expo SDK 56 the correct version is `~56.2.11`. Always match expo-router major to expo SDK major.

- **JDK version:** Plan says JDK 17. JDK 21 works fine with Expo SDK 56 / React Native 0.85.

- **`metro.config.js` required:** Must be created manually. `expo-router@56.x` pulls in `@expo/ui` and `react-native-worklets`, both of which ship TypeScript source. Metro skips transpiling `node_modules` by default, causing "Unable to resolve" errors. Fix: add these packages to `transformIgnorePatterns` in `metro.config.js`.

- **Always use `--legacy-peer-deps`:** Expo SDK 56 + React 19 has peer dep conflicts. All `npm install` calls must use `--legacy-peer-deps`. Avoid `npx expo install --fix` — it runs npm twice and the second pass fails.

- **Rebuild after every native dep change:** Any `npm install` of a native package requires a full `npx expo run:android`. Skipping this causes "Cannot find native module 'X'" runtime crashes.

- **MIUI install blocker:** On Poco M2 Pro, MIUI shows a "Send app for security check?" prompt that blocks installation. Fix: Developer Options → disable "Install via USB", or use `adb install -r` directly.

- **Starting Metro:** Use `npx expo start --dev-client` (not plain `npx expo start`). Plain start defaults to Expo Go mode and tries to download the Expo Go app instead of connecting to the installed custom APK.
