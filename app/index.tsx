import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MicButton } from '../src/components/MicButton';
import { TranscriptDisplay } from '../src/components/TranscriptDisplay';
import { useSpeechRecognition } from '../src/voice/useSpeechRecognition';
import { useTts } from '../src/voice/useTts';

// ── Session log entry ─────────────────────────────────────────────────────────

type LogEntry = { id: number; text: string };

let _logId = 0;

// ── Screen ────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const stt = useSpeechRecognition();
  const tts = useTts();
  const [log, setLog] = useState<LogEntry[]>([]);
  // Track which result (by id) we already logged. Keying off resultId — not the
  // text — means repeating the same phrase ("auto 50" twice) logs both times.
  const lastLoggedIdRef = useRef(0);

  // Load the Vosk model once on mount.
  useEffect(() => {
    stt.loadModel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Append each new committed result to the session log.
  useEffect(() => {
    if (
      stt.resultId > 0 &&
      stt.resultId !== lastLoggedIdRef.current &&
      stt.finalResult
    ) {
      lastLoggedIdRef.current = stt.resultId;
      setLog((prev) => [{ id: ++_logId, text: stt.finalResult }, ...prev].slice(0, 20));
    }
  }, [stt.resultId, stt.finalResult]);

  const handleMicPress = useCallback(() => {
    if (stt.isListening) {
      stt.stopListening();
    } else {
      stt.startListening();
    }
  }, [stt]);

  const handleEcho = useCallback(() => {
    if (!stt.finalResult) return;
    const text = stt.finalResult;
    stt.clearResults();
    tts.speak(text);
  }, [stt, tts]);

  const handleClear = useCallback(() => {
    stt.clearResults();
  }, [stt]);

  const showEcho = !!stt.finalResult && !stt.isListening && !tts.isSpeaking;
  const showClear = (!!stt.finalResult || !!stt.error) && !stt.isListening;

  return (
    <View style={styles.root}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.appName}>VoiceKhata</Text>
        <StatusDot isListening={stt.isListening} isSpeaking={tts.isSpeaking} isReady={stt.isModelLoaded} />
      </View>

      {/* ── Session log ───────────────────────────────────────────────────── */}
      <View style={styles.logArea}>
        {log.length === 0 ? (
          <View style={styles.logEmpty}>
            <Text style={styles.logEmptyText}>Your spoken commands will appear here</Text>
          </View>
        ) : (
          <FlatList
            data={log}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item, index }) => (
              <View style={[styles.logRow, index === 0 && styles.logRowLatest]}>
                <Text style={[styles.logText, index === 0 && styles.logTextLatest]} numberOfLines={2}>
                  {item.text}
                </Text>
              </View>
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.logContent}
          />
        )}
      </View>

      {/* ── Transcript ────────────────────────────────────────────────────── */}
      <TranscriptDisplay
        isModelLoaded={stt.isModelLoaded}
        isListening={stt.isListening}
        isTtsSpeaking={tts.isSpeaking}
        partialResult={stt.partialResult}
        finalResult={stt.finalResult}
        error={stt.error}
      />

      {/* ── Mic button ────────────────────────────────────────────────────── */}
      <View style={styles.micArea}>
        <MicButton
          isModelLoaded={stt.isModelLoaded}
          isListening={stt.isListening}
          isTtsSpeaking={tts.isSpeaking}
          onPress={handleMicPress}
        />
        <Text style={styles.micHint}>
          {!stt.isModelLoaded
            ? 'Loading model…'
            : stt.isListening
              ? 'Tap to stop'
              : tts.isSpeaking
                ? 'Speaking…'
                : 'Tap to speak'}
        </Text>
      </View>

      {/* ── Action buttons ────────────────────────────────────────────────── */}
      <View style={styles.actions}>
        {showEcho ? (
          <TouchableOpacity style={styles.echoBtn} onPress={handleEcho} activeOpacity={0.75}>
            <Text style={styles.echoBtnText}>Echo back</Text>
          </TouchableOpacity>
        ) : null}
        {showClear ? (
          <TouchableOpacity style={styles.clearBtn} onPress={handleClear} activeOpacity={0.75}>
            <Text style={styles.clearBtnText}>Clear</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* ── Sample commands hint ──────────────────────────────────────────── */}
      <View style={styles.hints}>
        <Text style={styles.hintsLabel}>Try:</Text>
        <Text style={styles.hintsText}>
          "gym 500 rupees paid"  ·  "spent 200 on auto"  ·  "how much spent on grocery this month"
        </Text>
      </View>
    </View>
  );
}

// ── Status dot ────────────────────────────────────────────────────────────────

function StatusDot({ isListening, isSpeaking, isReady }: {
  isListening: boolean;
  isSpeaking: boolean;
  isReady: boolean;
}) {
  const color = isListening ? '#e05260' : isSpeaking ? '#f0a030' : isReady ? '#4ade80' : '#60607a';
  const label = isListening ? 'Listening' : isSpeaking ? 'Speaking' : isReady ? 'Ready' : 'Loading';
  return (
    <View style={dotStyles.row}>
      <View style={[dotStyles.dot, { backgroundColor: color }]} />
      <Text style={[dotStyles.label, { color }]}>{label}</Text>
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 12, fontWeight: '600' },
});

// ── Colors ────────────────────────────────────────────────────────────────────

const C = {
  bg: '#0f0f1a',
  surface: '#16162a',
  surfaceHigh: '#1e1e36',
  border: '#252540',
  accent: '#7c83fd',
  muted: '#8888aa',
  dim: '#555570',
  white: '#e8e8f0',
  red: '#e05260',
  green: '#4ade80',
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 10,
  },
  appName: {
    color: C.white,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  // Session log — takes remaining space between header and transcript
  logArea: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 8,
    overflow: 'hidden',
  },
  logEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  logEmptyText: {
    color: C.dim,
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  logContent: { padding: 10 },
  logRow: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: C.surfaceHigh,
  },
  logRowLatest: {
    borderLeftWidth: 3,
    borderLeftColor: C.accent,
  },
  logText: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  logTextLatest: {
    color: C.white,
    fontWeight: '500',
  },

  // Mic area
  micArea: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  micHint: {
    marginTop: 10,
    color: C.muted,
    fontSize: 13,
    fontStyle: 'italic',
  },

  // Action buttons
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    height: 44,
    alignItems: 'center',
    marginBottom: 4,
  },
  echoBtn: {
    backgroundColor: C.accent,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 22,
  },
  echoBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  clearBtn: {
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: C.border,
  },
  clearBtnText: { color: C.dim, fontSize: 14 },

  // Hints bar
  hints: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingTop: 4,
    paddingBottom: 2,
  },
  hintsLabel: {
    color: C.dim,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 1,
  },
  hintsText: {
    flex: 1,
    color: C.dim,
    fontSize: 11,
    lineHeight: 16,
  },
});
