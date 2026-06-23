import { StyleSheet, Text, View } from 'react-native';

type Props = {
  isModelLoaded: boolean;
  isListening: boolean;
  isTtsSpeaking: boolean;
  partialResult: string;
  finalResult: string;
  error: string | null;
};

export function TranscriptDisplay({
  isModelLoaded,
  isListening,
  isTtsSpeaking,
  partialResult,
  finalResult,
  error,
}: Props) {
  // Decide which primary line to show (only one at a time).
  let status = '';
  let transcript = '';
  let transcriptKind: 'partial' | 'final' | 'none' = 'none';

  if (!isModelLoaded) {
    status = 'Loading voice model…';
  } else if (error) {
    // Error shown inline — no separate status line.
  } else if (isTtsSpeaking) {
    status = 'Speaking…';
  } else if (isListening) {
    status = partialResult ? '' : 'Listening…';
    if (partialResult) {
      transcript = partialResult;
      transcriptKind = 'partial';
    }
  } else if (finalResult) {
    transcript = finalResult;
    transcriptKind = 'final';
  } else {
    status = 'Tap the mic to start';
  }

  return (
    // Fixed height prevents layout shifts when partial results stream in —
    // the mic button and buttons below stay in place on every update.
    <View style={styles.container}>
      {error ? (
        <Text style={styles.errorText} numberOfLines={2}>
          {error}
        </Text>
      ) : transcript ? (
        <Text
          style={[styles.transcript, transcriptKind === 'final' ? styles.final : styles.partial]}
          numberOfLines={3}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {transcript}
        </Text>
      ) : (
        <Text style={styles.status}>{status}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Fixed height = 3 lines of transcript at lineHeight 26 + vertical padding
  container: {
    height: 96,
    width: '100%',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: {
    color: '#a0a0b0',
    fontSize: 15,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  transcript: {
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 26,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  partial: {
    color: '#8888aa',
  },
  final: {
    color: '#e8e8f0',
  },
  errorText: {
    color: '#e05260',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});
