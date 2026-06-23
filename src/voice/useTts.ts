import { useCallback, useEffect, useRef, useState } from 'react';
import * as Speech from 'expo-speech';

export type TtsState = {
  isSpeaking: boolean;
  speak: (text: string, onDone?: () => void) => void;
  stop: () => void;
};

// Android's TTS engine cold-starts on first use (~1–2s while it binds the
// service and loads the voice). We warm it on mount so the first real response
// is fast. getInitializedTtsAsync isn't exposed by expo-speech, so we kick the
// engine with a near-silent utterance at volume the user won't notice.
const TTS_OPTIONS: Speech.SpeechOptions = {
  language: 'en-IN',
  rate: 0.95,
  pitch: 1.0,
};

export function useTts(): TtsState {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const mountedRef = useRef(true);
  const activeSpeakRef = useRef(false);

  // ── Warm up the engine once on mount ───────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    // Touch the engine so the native service is bound before the first response.
    // A volume-0 space primes the pipeline without audible output.
    Speech.getAvailableVoicesAsync().catch(() => {});
    try {
      Speech.speak(' ', { ...TTS_OPTIONS, volume: 0, onError: () => {} });
    } catch {}

    return () => {
      mountedRef.current = false;
      if (activeSpeakRef.current) {
        Speech.stop().catch(() => {});
      }
    };
  }, []);

  const stop = useCallback(() => {
    if (!activeSpeakRef.current) return;
    activeSpeakRef.current = false;
    Speech.stop().then(() => {
      if (mountedRef.current) setIsSpeaking(false);
    }).catch(() => {
      if (mountedRef.current) setIsSpeaking(false);
    });
  }, []);

  const speak = useCallback((text: string, onDone?: () => void) => {
    if (!text.trim()) {
      onDone?.();
      return;
    }

    const doSpeak = () => {
      if (!mountedRef.current) return;
      activeSpeakRef.current = true;
      setIsSpeaking(true);

      Speech.speak(text, {
        ...TTS_OPTIONS,
        onStart: () => {
          if (mountedRef.current) setIsSpeaking(true);
        },
        onDone: () => {
          activeSpeakRef.current = false;
          if (mountedRef.current) setIsSpeaking(false);
          onDone?.();
        },
        onStopped: () => {
          activeSpeakRef.current = false;
          if (mountedRef.current) setIsSpeaking(false);
        },
        onError: () => {
          activeSpeakRef.current = false;
          if (mountedRef.current) setIsSpeaking(false);
          onDone?.();
        },
      });
    };

    // Only pay the stop() round-trip when something is actually speaking.
    if (activeSpeakRef.current) {
      activeSpeakRef.current = false;
      Speech.stop().then(doSpeak).catch(doSpeak);
    } else {
      doSpeak();
    }
  }, []);

  return { isSpeaking, speak, stop };
}
