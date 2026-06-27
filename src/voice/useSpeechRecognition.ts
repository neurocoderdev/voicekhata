import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import * as Vosk from 'react-native-vosk';
import { VOSK_GRAMMAR } from '../utils/constants';

export type SpeechRecognitionState = {
  isModelLoaded: boolean;
  isListening: boolean;
  partialResult: string;
  finalResult: string;
  // Increments once per committed final result. Lets consumers react to a NEW
  // result even when the recognized text is identical to the previous one
  // (e.g. saying "auto 50" twice). Compare this, not the finalResult string.
  resultId: number;
  // Bumps once each time a session ends with NO speech recognized. Lets the UI
  // respond ("I didn't catch that") to a silent stop, which resultId never signals.
  emptyResultId: number;
  error: string | null;
  // True when loadModel() failed (vs. a transient recognition error). Drives the
  // "Couldn't load voice — Retry" affordance on the Home screen.
  modelLoadFailed: boolean;
  // True when the microphone permission was denied. The Home screen shows an
  // explain row with "Open Settings" since MIUI won't re-prompt once denied.
  micPermissionDenied: boolean;
  loadModel: () => Promise<void>;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  clearResults: () => void;
  // Open the OS app-settings screen so the user can grant the mic permission.
  openAppSettings: () => void;
};

const MODEL_PATH = 'model-en-in';

// ── Recognition mode ────────────────────────────────────────────────────────
// Vosk can run in two modes:
//   • Grammar-constrained (start({grammar})): only outputs words on VOSK_GRAMMAR
//     (+"[unk]"). Rock-solid on the exact phrases listed, but ANY word not in the
//     list — including natural connective speech and many query phrasings — comes
//     back as "[unk]", and continuous speech degrades badly. This was the cause
//     of the "can't recognize continuous words / everything is [unk]" problem.
//   • Free dictation (start() with no grammar): uses the model's full ~vocabulary.
//     Far better on continuous, natural speech. Misrecognitions are absorbed
//     downstream by the parser's fuzzy category matcher + number-word normalizer.
//
// We default to GRAMMAR-CONSTRAINED mode. The small Indian-English model is far
// more accurate when the decoder is restricted to the words our app uses than in
// free dictation (which skipped words and produced phonetic garbage like
// "jim"). The grammar (VOSK_GRAMMAR) is kept VAST — every parser word + synonyms
// + both digit and word numbers — so almost nothing legitimate becomes "[unk]".
// Synonyms/misrecognitions that still slip through are mapped by the category
// matcher's synonym layer. Flip to false to A/B test free dictation.
const USE_GRAMMAR = true;

// Hard ceiling on a single listening session. The native SpeechService has its
// own VAD but in push-to-talk we drive stop() manually; this watchdog guarantees
// the mic is always released even if the user never taps stop. Free dictation
// benefits from a longer ceiling so a full natural sentence isn't cut off.
const MAX_SESSION_MS = 20000;

// How long to wait after Vosk.stop()/unload() before the native SpeechService is
// guaranteed torn down (it does stop() + shutdown() on a background thread).
const STOP_SETTLE_MS = 250;

// After stop(), how long to wait for the native onFinalResult to deliver the last
// segment before we give up and commit the accumulated text ourselves.
const FINAL_GRACE_MS = 600;
const STOP_POLL_MS = 30;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSpeechRecognition(): SpeechRecognitionState {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const [partialResult, setPartialResult] = useState('');
  const [finalResult, setFinalResult] = useState('');
  const [resultId, setResultId] = useState(0);
  // Bumps when a listening session ends with no recognized speech at all.
  const [emptyResultId, setEmptyResultId] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [modelLoadFailed, setModelLoadFailed] = useState(false);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);

  // Refs mirror the latest values for use inside event callbacks (no stale closure).
  const loadingRef = useRef(false);
  const loadedRef = useRef(false);
  const listeningRef = useRef(false);

  // Guard: true from the moment stop begins until the native service is released.
  const stoppingRef = useRef(false);

  // True once finishSession has committed a result for the current session.
  // Reset when a new session starts. Prevents double-commit AND lets a late
  // native onFinalResult be recognized as "already handled".
  const finalizedRef = useRef(false);

  // Accumulates the recognized text across silence-delimited segments. The native
  // onResult event fires on EVERY internal silence pause (not just at the end), so
  // we concatenate those segments and only treat the session as finished when WE
  // call stop() (push-to-talk) or the watchdog/timeout fires.
  const accumRef = useRef('');

  // Active event subscriptions for the current session.
  const subsRef = useRef<{ remove: () => void }[]>([]);

  // Watchdog handle for MAX_SESSION_MS.
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ref to stopListening so the watchdog (created inside startListening) can call
  // it without a definition-order or stale-closure dependency.
  const stopListeningRef = useRef<() => Promise<void>>(async () => {});

  const clearSubscriptions = useCallback(() => {
    subsRef.current.forEach((s) => {
      try { s.remove(); } catch {}
    });
    subsRef.current = [];
  }, []);

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  // Release the native recognizer and reset session flags. Idempotent.
  const releaseNative = useCallback(async () => {
    clearWatchdog();
    try { Vosk.stop(); } catch {}
    await sleep(STOP_SETTLE_MS);
  }, [clearWatchdog]);

  // ── Model load ─────────────────────────────────────────────────────────────

  const loadModel = useCallback(async () => {
    if (loadedRef.current || loadingRef.current) return;
    loadingRef.current = true;
    setError(null);
    setModelLoadFailed(false);

    // A previous JS bundle (Fast Refresh) may have left a live SpeechService and
    // model inside the native singleton. unload() stops the recognizer AND closes
    // the model, giving loadModel() a clean slate — a bare stop() is not enough
    // because the old model would otherwise be fed by a stale service and crash.
    try { Vosk.unload(); } catch {}
    await sleep(STOP_SETTLE_MS);

    try {
      await Vosk.loadModel(MODEL_PATH);
      loadedRef.current = true;
      setIsModelLoaded(true);
      setModelLoadFailed(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Could not load the voice model. ${msg}`);
      setModelLoadFailed(true);
    } finally {
      loadingRef.current = false;
    }
  }, []);

  // ── End-of-session handling ──────────────────────────────────────────────────

  // Commit whatever has accumulated as the final result and tear the session down.
  //
  // May be called more than once for a single session (e.g. the stop() safety net
  // fires first, then a slightly-late native onFinalResult arrives). The first
  // call commits and bumps resultId; a later call carrying NEW trailing text that
  // the early commit missed will update the text and bump resultId again so the
  // last segment is never lost. Calls with no new information are no-ops.
  const finishSession = useCallback((trailing?: string) => {
    const wasActive = listeningRef.current || stoppingRef.current;
    const tail = trailing?.trim();

    // Append the trailing final segment unless the recognizer simply re-emitted
    // the last accumulated segment (avoids "gym 500 gym 500" duplication).
    let appended = false;
    if (tail) {
      const acc = accumRef.current.trim();
      if (!acc.endsWith(tail)) {
        accumRef.current = `${acc} ${tail}`.trim();
        appended = true;
      }
    }

    // Nothing new to do: already finalized and this event added no text.
    if (finalizedRef.current && !appended) return;
    // Session already torn down and there's no new trailing text — ignore stray event.
    if (!wasActive && !appended) return;

    const result = accumRef.current.trim();
    const firstCommitThisSession = !finalizedRef.current;

    listeningRef.current = false;
    setIsListening(false);
    setPartialResult('');
    if (result) setFinalResult(result);

    // Bump resultId on every genuine commit/augment so consumers always see a
    // new result — even when the text is identical to the previous session's.
    if (result && (!finalizedRef.current || appended)) {
      setResultId((n) => n + 1);
    }

    // A session that ended with NO recognized speech (user tapped stop on silence,
    // or VAD timed out empty) bumps a separate counter so the consumer can speak
    // "I didn't catch that" — resultId alone would never fire for an empty result.
    if (!result && firstCommitThisSession) {
      setEmptyResultId((n) => n + 1);
    }
    finalizedRef.current = true;

    clearWatchdog();
    clearSubscriptions();
  }, [clearSubscriptions, clearWatchdog]);

  // Abandon the current session WITHOUT committing a result. Unlike
  // finishSession, this never bumps resultId/emptyResultId — so it can't trigger
  // a downstream auto-dispatch of a half-spoken command. Used when the app is
  // backgrounded mid-recognition: discarding an unfinished, unconfirmed command
  // is safer than silently saving whatever fragment was captured.
  const abortSession = useCallback(() => {
    listeningRef.current = false;
    stoppingRef.current = false;
    finalizedRef.current = true; // mark handled so a late native event is ignored
    accumRef.current = '';
    setIsListening(false);
    setPartialResult('');
    clearWatchdog();
    clearSubscriptions();
    try { Vosk.stop(); } catch {}
  }, [clearSubscriptions, clearWatchdog]);

  // ── Start listening ────────────────────────────────────────────────────────

  const startListening = useCallback(async () => {
    if (!loadedRef.current) {
      setError('Voice model not ready. Please wait.');
      return;
    }
    if (listeningRef.current || stoppingRef.current) return;

    // Reset session state.
    accumRef.current = '';
    finalizedRef.current = false;
    setPartialResult('');
    setFinalResult('');
    setError(null);

    // Defensive: make sure no native service is lingering from a prior session
    // that ended abnormally. This is what makes the 2nd+ recording reliable.
    await releaseNative();

    clearSubscriptions();

    const partialSub = Vosk.onPartialResult((text: string) => {
      if (!listeningRef.current) return;
      // Show accumulated text + the live partial so the user sees the full phrase.
      const live = text?.trim() ?? '';
      const combined = `${accumRef.current} ${live}`.trim();
      setPartialResult(combined);
    });

    // onResult = "called after silence occurred". In a multi-word command the user
    // pauses naturally; each pause emits a segment. ACCUMULATE — do NOT end here.
    const resultSub = Vosk.onResult((text: string) => {
      if (!listeningRef.current) return;
      const seg = text?.trim() ?? '';
      if (seg) {
        accumRef.current = `${accumRef.current} ${seg}`.trim();
        setPartialResult(accumRef.current);
      }
    });

    // onFinalResult = "called after stream end, like a stop() call". THIS is the
    // real end of a push-to-talk session.
    const finalSub = Vosk.onFinalResult((text: string) => {
      finishSession(text);
    });

    const errorSub = Vosk.onError((e: unknown) => {
      const msg = typeof e === 'string' ? e : (e instanceof Error ? e.message : String(e));
      // Stale native service — release and let the user tap again. We do NOT
      // auto-retry start() here: an auto-retry loop was the original cause of the
      // mic staying hot. Releasing and surfacing a clean state is safer.
      if (msg.includes('already in use')) {
        listeningRef.current = false;
        setIsListening(false);
        clearWatchdog();
        clearSubscriptions();
        releaseNative();
        return;
      }
      listeningRef.current = false;
      setIsListening(false);
      setError(msg);
      clearWatchdog();
      clearSubscriptions();
    });

    // onTimeout = native VAD/timeout fired; native already cleaned the recognizer.
    const timeoutSub = Vosk.onTimeout(() => {
      finishSession();
    });

    subsRef.current = [partialSub, resultSub, finalSub, errorSub, timeoutSub];

    try {
      // Free dictation by default (no grammar) for natural continuous speech;
      // grammar-constrained only if USE_GRAMMAR is flipped on. A native timeout
      // backs up our JS watchdog either way.
      const startOptions = USE_GRAMMAR
        ? { grammar: VOSK_GRAMMAR, timeout: MAX_SESSION_MS }
        : { timeout: MAX_SESSION_MS };
      await Vosk.start(startOptions);
      listeningRef.current = true;
      setIsListening(true);
      setMicPermissionDenied(false);

      // JS watchdog: guarantees the mic is released even if no native event fires.
      clearWatchdog();
      watchdogRef.current = setTimeout(() => {
        if (listeningRef.current) {
          // Force a manual stop → onFinalResult will commit the accumulated text.
          stopListeningRef.current();
        }
      }, MAX_SESSION_MS + 500);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      clearSubscriptions();
      if (msg.includes('already in use')) {
        // Native service from a prior session is still tearing down. Release it
        // fully so the next tap works; surface nothing — user simply taps again.
        await releaseNative();
        return;
      }
      // Vosk rejects with 'Record permission not granted' when the mic permission
      // is denied. Surface a dedicated flag so the UI can guide the user to
      // Settings (MIUI won't re-prompt once permanently denied).
      if (/permission/i.test(msg)) {
        setMicPermissionDenied(true);
        setError('Microphone access is needed to record expenses.');
        return;
      }
      setError(`Start failed: ${msg}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearSubscriptions, clearWatchdog, finishSession, releaseNative]);

  // ── Stop listening (manual / push-to-talk end) ───────────────────────────────

  const stopListening = useCallback(async () => {
    if (!listeningRef.current || stoppingRef.current) return;

    stoppingRef.current = true;
    clearWatchdog();

    try {
      // stop() triggers the native onFinalResult, which calls finishSession() and
      // releases everything. We keep the event listeners alive and poll for that
      // commit rather than blindly finalizing — otherwise a final result that is
      // slightly slow than our settle window would lose the last spoken segment.
      Vosk.stop();
    } catch {}

    // Wait up to FINAL_GRACE_MS for the native onFinalResult to commit. Poll in
    // short steps; bail as soon as finishSession has run.
    const deadline = FINAL_GRACE_MS;
    let waited = 0;
    while (!finalizedRef.current && waited < deadline) {
      await sleep(STOP_POLL_MS);
      waited += STOP_POLL_MS;
    }

    // Safety net: onFinalResult never arrived (e.g. no speech captured). Commit
    // whatever accumulated so the session always ends cleanly.
    if (!finalizedRef.current) {
      finishSession();
    }
    stoppingRef.current = false;
  }, [clearWatchdog, finishSession]);

  // Keep the ref pointing at the latest stopListening for the watchdog to call.
  stopListeningRef.current = stopListening;

  // ── Clear ──────────────────────────────────────────────────────────────────

  const clearResults = useCallback(() => {
    accumRef.current = '';
    setPartialResult('');
    setFinalResult('');
    setError(null);
  }, []);

  // Open the OS app-settings page so the user can flip the mic permission on.
  const openAppSettings = useCallback(() => {
    Linking.openSettings().catch(() => {});
  }, []);

  // ── Stop cleanly when the app leaves the foreground ──────────────────────────
  // Holding a live SpeechService in the background is wasteful and, on some MIUI
  // builds, the OS revokes the mic on background and the next start() then fails.
  // Releasing here keeps state consistent: the user simply taps again on return.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') {
        // Leaving the foreground mid-session: ABANDON it (don't commit). The
        // captured fragment is unconfirmed and likely partial — auto-dispatching
        // it on return could silently save a wrong expense. Better to drop it.
        if (listeningRef.current || stoppingRef.current) {
          abortSession();
        }
      } else {
        // Back in the foreground: the user may have just granted the mic
        // permission in Settings, so clear the stale "denied" affordance and let
        // them try again. (A real denial re-trips on the next start attempt.)
        setMicPermissionDenied(false);
      }
    });
    return () => sub.remove();
  }, [abortSession]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      clearWatchdog();
      clearSubscriptions();
      try { Vosk.stop(); } catch {}
    };
  }, [clearSubscriptions, clearWatchdog]);

  return {
    isModelLoaded,
    isListening,
    partialResult,
    finalResult,
    resultId,
    emptyResultId,
    error,
    modelLoadFailed,
    micPermissionDenied,
    loadModel,
    startListening,
    stopListening,
    clearResults,
    openAppSettings,
  };
}
