import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const C = {
  bg: '#0f0f1a',
  accent: '#7c83fd',
  white: '#e8e8f0',
  muted: '#8888aa',
  red: '#e05260',
};

// Full-screen loading splash shown while the database initializes (≈ instant on
// most launches; the Vosk model loads in the background after this clears).
export function LoadingGate({ message = 'Starting VoiceKhata…' }: { message?: string }) {
  return (
    <View style={styles.root}>
      <Text style={styles.logo}>🎙</Text>
      <Text style={styles.brand}>VoiceKhata</Text>
      <ActivityIndicator color={C.accent} style={{ marginTop: 20 }} />
      <Text style={styles.sub}>{message}</Text>
    </View>
  );
}

// Shown only when the database cannot be opened or rebuilt — a hard failure.
// Offers a retry that re-runs initialization.
export function DbErrorGate({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.root}>
      <Text style={styles.logo}>💾</Text>
      <Text style={styles.brand}>Storage problem</Text>
      <Text style={styles.errSub}>
        VoiceKhata could not open its database. This is usually temporary. Tap retry; if it keeps
        happening, free up some storage space.
      </Text>
      <TouchableOpacity style={styles.btn} onPress={onRetry} activeOpacity={0.85}>
        <Text style={styles.btnText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
  logo: { fontSize: 52 },
  brand: { color: C.white, fontSize: 22, fontWeight: '800', marginTop: 14, letterSpacing: 0.5 },
  sub: { color: C.muted, fontSize: 13, marginTop: 12 },
  errSub: { color: C.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 12, marginBottom: 26 },
  btn: { backgroundColor: C.accent, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 40 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
