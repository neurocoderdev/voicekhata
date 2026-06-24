import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MicButton } from '../src/components/MicButton';
import { TranscriptDisplay } from '../src/components/TranscriptDisplay';
import { ExpenseCard } from '../src/components/ExpenseCard';
import { CommandEditorModal } from '../src/components/CommandEditorModal';
import { useSpeechRecognition } from '../src/voice/useSpeechRecognition';
import { useTts } from '../src/voice/useTts';
import { useVoiceCommand, type CommandOutcome } from '../src/voice/useVoiceCommand';
import { useAppStore } from '../src/store/useAppStore';
import { formatCurrency, formatMonthLabel, todayIso } from '../src/utils/formatters';

export default function HomeScreen() {
  const stt = useSpeechRecognition();
  const tts = useTts();
  const { handleCommand } = useVoiceCommand(tts);

  const isDbReady = useAppStore((s) => s.isDbReady);
  const monthlyTotal = useAppStore((s) => s.monthlyTotal);
  const recentExpenses = useAppStore((s) => s.recentExpenses);
  const refreshAll = useAppStore((s) => s.refreshAll);
  const confirmBeforeSubmit = useAppStore((s) => s.confirmBeforeSubmit);
  const setConfirmBeforeSubmit = useAppStore((s) => s.setConfirmBeforeSubmit);

  const [outcome, setOutcome] = useState<CommandOutcome | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Editor modal state.
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorText, setEditorText] = useState('');
  const [editorTitle, setEditorTitle] = useState('Confirm command');

  // Act on resultId / emptyResultId (monotonic counters), NOT the result string —
  // saying the same command twice must fire twice, and a silent stop still signals.
  const lastHandledIdRef = useRef(0);
  const lastEmptyIdRef = useRef(0);

  // Run a command end-to-end (parse → DB → TTS) and surface its outcome.
  const runCommand = useCallback(
    (text: string) => {
      handleCommand(text).then(setOutcome);
    },
    [handleCommand]
  );

  // Decide how a freshly captured/typed command is dispatched: straight through,
  // or via the editable confirm popup when the toggle is on.
  const dispatch = useCallback(
    (text: string) => {
      if (confirmBeforeSubmit) {
        setEditorTitle('Confirm command');
        setEditorText(text);
        setEditorVisible(true);
      } else {
        runCommand(text);
      }
    },
    [confirmBeforeSubmit, runCommand]
  );

  // Load the Vosk model once on mount.
  useEffect(() => {
    stt.loadModel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pull monthly total + expense list as soon as the DB is ready.
  useEffect(() => {
    if (isDbReady) refreshAll();
  }, [isDbReady, refreshAll]);

  // New recognized result → dispatch (direct or via confirm popup).
  useEffect(() => {
    if (
      stt.resultId > 0 &&
      stt.resultId !== lastHandledIdRef.current &&
      stt.finalResult
    ) {
      lastHandledIdRef.current = stt.resultId;
      const text = stt.finalResult;
      stt.clearResults();
      dispatch(text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stt.resultId, stt.finalResult]);

  // Session ended with no speech → always prompt to retry (never a confirm popup).
  useEffect(() => {
    if (stt.emptyResultId > 0 && stt.emptyResultId !== lastEmptyIdRef.current) {
      lastEmptyIdRef.current = stt.emptyResultId;
      runCommand(''); // orchestrator speaks "I didn't catch that. Please try again."
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stt.emptyResultId]);

  const handleMicPress = useCallback(() => {
    if (tts.isSpeaking) return; // never let mic and TTS overlap
    if (stt.isListening) {
      stt.stopListening();
    } else {
      setOutcome(null);
      stt.startListening();
    }
  }, [stt, tts.isSpeaking]);

  // "Type here" → open an empty editor regardless of the toggle.
  const openTypeEditor = useCallback(() => {
    if (stt.isListening) stt.stopListening();
    setEditorTitle('Type a command');
    setEditorText('');
    setEditorVisible(true);
  }, [stt]);

  const onEditorSubmit = useCallback(
    (text: string) => {
      setEditorVisible(false);
      runCommand(text);
    },
    [runCommand]
  );

  const onEditorCancel = useCallback(() => setEditorVisible(false), []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
  }, [refreshAll]);

  return (
    <View style={styles.root}>
      <FlatList
        data={recentExpenses}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />
        }
        ListHeaderComponent={
          <View>
            {/* ── Monthly summary card ──────────────────────────────────── */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryMonth}>{formatMonthLabel(todayIso())}</Text>
              <Text style={styles.summaryAmount}>{formatCurrency(monthlyTotal)}</Text>
              <Text style={styles.summaryLabel}>spent this month</Text>
            </View>

            {/* ── Confirm-before-submit toggle ──────────────────────────── */}
            <View style={styles.toggleRow}>
              <View style={styles.toggleTextWrap}>
                <Text style={styles.toggleLabel}>Confirm before submit</Text>
                <Text style={styles.toggleHint}>Review & edit each command before it runs</Text>
              </View>
              <Switch
                value={confirmBeforeSubmit}
                onValueChange={setConfirmBeforeSubmit}
                trackColor={{ false: '#2e2e50', true: C.accent }}
                thumbColor="#fff"
              />
            </View>

            {/* ── Voice control ─────────────────────────────────────────── */}
            <TranscriptDisplay
              isModelLoaded={stt.isModelLoaded}
              isListening={stt.isListening}
              isTtsSpeaking={tts.isSpeaking}
              partialResult={stt.partialResult}
              finalResult={stt.finalResult}
              error={stt.error}
            />

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

            {/* ── Type here ─────────────────────────────────────────────── */}
            <TouchableOpacity style={styles.typeBtn} onPress={openTypeEditor} activeOpacity={0.8}>
              <Text style={styles.typeBtnText}>⌨  Type a command instead</Text>
            </TouchableOpacity>

            {/* ── Last command feedback ─────────────────────────────────── */}
            {outcome ? (
              <View style={[styles.feedback, feedbackStyle(outcome.kind)]}>
                <Text style={styles.feedbackText}>{outcome.message}</Text>
              </View>
            ) : (
              <View style={styles.hints}>
                <Text style={styles.hintsText}>
                  Try: "gym 500 rupees paid" · "spent 200 on auto" · "how much spent on grocery this month"
                </Text>
              </View>
            )}

            <Text style={styles.listTitle}>Recent expenses</Text>
          </View>
        }
        renderItem={({ item }) => <ExpenseCard expense={item} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No expenses yet.</Text>
            <Text style={styles.emptyHint}>Tap the mic and say "gym 500 rupees paid".</Text>
          </View>
        }
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      />

      <CommandEditorModal
        visible={editorVisible}
        initialText={editorText}
        title={editorTitle}
        onSubmit={onEditorSubmit}
        onCancel={onEditorCancel}
      />
    </View>
  );
}

// ── Feedback color by outcome kind ─────────────────────────────────────────────

function feedbackStyle(kind: CommandOutcome['kind']) {
  switch (kind) {
    case 'added':
    case 'created':
      return { borderLeftColor: C.green };
    case 'query':
    case 'export':
      return { borderLeftColor: C.accent };
    case 'prompt':
    case 'unknown':
      return { borderLeftColor: C.amber };
    case 'error':
    default:
      return { borderLeftColor: C.red };
  }
}

// ── Colors ──────────────────────────────────────────────────────────────────

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
  amber: '#f0a030',
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 32 },

  // Monthly summary card
  summaryCard: {
    backgroundColor: C.surfaceHigh,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 10,
  },
  summaryMonth: {
    color: C.muted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  summaryAmount: { color: C.white, fontSize: 34, fontWeight: '800', marginTop: 4 },
  summaryLabel: { color: C.dim, fontSize: 12, marginTop: 2 },

  // Confirm toggle
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  toggleTextWrap: { flex: 1, marginRight: 12 },
  toggleLabel: { color: C.white, fontSize: 14, fontWeight: '600' },
  toggleHint: { color: C.dim, fontSize: 11, marginTop: 2 },

  // Mic area
  micArea: { alignItems: 'center', paddingVertical: 6 },
  micHint: { marginTop: 8, color: C.muted, fontSize: 13, fontStyle: 'italic' },

  // Type here button
  typeBtn: {
    alignSelf: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 8,
    paddingHorizontal: 18,
    marginTop: 4,
    marginBottom: 4,
  },
  typeBtnText: { color: C.muted, fontSize: 13, fontWeight: '600' },

  // Feedback line
  feedback: {
    backgroundColor: C.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 3,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 8,
    marginBottom: 4,
  },
  feedbackText: { color: C.white, fontSize: 14, lineHeight: 20 },

  // Hints
  hints: { paddingHorizontal: 4, paddingVertical: 10, marginTop: 4 },
  hintsText: { color: C.dim, fontSize: 12, lineHeight: 18, textAlign: 'center' },

  // Recent list
  listTitle: {
    color: C.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 14,
    marginBottom: 10,
  },
  empty: { alignItems: 'center', paddingVertical: 30 },
  emptyText: { color: C.muted, fontSize: 15, fontWeight: '600' },
  emptyHint: { color: C.dim, fontSize: 13, marginTop: 6, textAlign: 'center' },
});
