# VoiceKhata

A voice-controlled, fully offline Android expense tracker. Speak your expenses — no typing, no cloud, no paid APIs. Total cost: ₹0.

> Built for Poco M2 Pro (Snapdragon 720G, Android 10). Works on any Android 8+ device.

---

## What it does

- **Add expenses by voice** — say "spent 250 on groceries yesterday" and it's saved
- **Query spending** — "how much did I spend on food this month"
- **Fuzzy category matching** — handles Vosk misrecognitions gracefully
- **Relative date resolution** — understands "yesterday", "3 days ago", "last Monday", "on the 15th"
- **Export to CSV** — monthly reports saved to device storage, shareable via any app
- **Spoken responses** — answers back using Android's built-in TTS engine

No internet. No LLM. No subscriptions. Everything runs on-device.

---

## Architecture

```
Voice Input (Vosk STT)
        ↓
  Intent Parser  ←── dateResolver → categoryMatcher
        ↓
   SQLite DB  (expo-sqlite)
        ↓
  TTS Response (expo-speech)
```

The intent parser is a **deterministic regex engine** — not an AI model. The domain (expense tracking) is narrow enough that rule-based parsing gives testable, hallucination-free, zero-latency results.

### Three strict layers

| Layer | Location | Notes |
|---|---|---|
| Voice I/O | `src/voice/` | Vosk STT + expo-speech TTS |
| Parser | `src/parser/` | Pure TypeScript, zero side effects |
| Data | `src/db/` | SQLite via expo-sqlite |

The parser has **zero imports** from `src/db/` or `src/voice/` — it is fully testable without a device.

---

## Tech Stack

| Purpose | Package |
|---|---|
| Framework | React Native + Expo (dev build) |
| Language | TypeScript |
| Offline STT | `react-native-vosk` + `vosk-model-small-en-in-0.4` |
| Intent parsing | Custom regex engine |
| Fuzzy matching | `fuse.js` |
| Date math | `date-fns` |
| Database | `expo-sqlite` |
| TTS | `expo-speech` (Android built-in engine) |
| Export | `expo-file-system` + `expo-sharing` |
| Navigation | `expo-router` |
| State | `zustand` |

---

## Prerequisites

- Node.js 18+
- Android SDK (API 29+) or a physical Android device
- JDK 17
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- A Vosk model placed at `assets/model-en-in/` (see below)

### Download the Vosk model

```bash
# From the project root
curl -LO https://alphacephei.com/vosk/models/vosk-model-small-en-in-0.4.zip
unzip vosk-model-small-en-in-0.4.zip
cp -r vosk-model-small-en-in-0.4/* assets/model-en-in/
rm -rf vosk-model-small-en-in-0.4 vosk-model-small-en-in-0.4.zip
```

The model is ~50 MB and is excluded from git via `.gitignore`.

---

## Setup & Run

```bash
# 1. Clone the repo
git clone https://github.com/<your-username>/voicekhata.git
cd voicekhata

# 2. Install dependencies
npm install

# 3. Generate native Android project (first time only, or after adding native deps)
npx expo prebuild --platform android

# 4. Connect your Android device via USB (enable USB debugging)
#    OR start an Android emulator

# 5. Run on device
npx expo run:android
```

> **Note:** `expo run:android` builds a debug APK and installs it directly. The Vosk model must be in `assets/model-en-in/` before this step.

---

## Run Tests

```bash
# All parser + export tests
npm test

# Single file
npx jest src/parser/intentParser.test.ts

# Watch mode
npm run test:watch

# Type check
npm run typecheck
```

Tests are pure TypeScript — no device, no emulator, no SQLite needed.

---

## Build a Release APK

```bash
# Local release build (arm64-only, ~87 MB)
cd android && ./gradlew assembleRelease

# Output: android/app/build/outputs/apk/release/app-release.apk
```

---

## Voice Command Examples

| Say | Action |
|---|---|
| "spent 150 on lunch" | Adds ₹150 under Food, today |
| "added 500 for groceries yesterday" | Adds ₹500 under Groceries, yesterday |
| "how much did I spend on food this month" | Queries monthly Food total |
| "show total for last week" | Queries last week's total |
| "create category gym" | Creates a new category |
| "export this month" | Exports monthly CSV |

---

## Project Structure

```
voicekhata/
├── app/                   # Expo Router screens (tabs)
│   ├── index.tsx          # Home — mic button, recent expenses
│   ├── history.tsx        # Full expense history
│   └── categories.tsx     # Category list with totals
├── src/
│   ├── parser/            # Regex intent parser (pure TS)
│   │   ├── intentParser.ts
│   │   ├── dateResolver.ts
│   │   ├── categoryMatcher.ts
│   │   └── *.test.ts
│   ├── db/                # SQLite repositories
│   ├── voice/             # Vosk STT + TTS hooks
│   ├── components/        # Shared UI components
│   ├── store/             # Zustand global state
│   └── export/            # CSV export logic
├── assets/
│   └── model-en-in/       # Vosk model (not in git)
└── android/               # Generated native project (not in git)
```

---

## Constraints (by design)

- **No LLM in v1** — deterministic regex parser only
- **Fully offline** — no network calls anywhere
- **APK size target** — < 80 MB (arm64-only build achieves ~87 MB)
- **Memory budget** — Vosk (~150 MB loaded) + app (~50 MB) = ~200 MB peak

---

## License

MIT
