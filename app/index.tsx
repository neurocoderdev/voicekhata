import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>VoiceKhata</Text>
      <Text style={styles.subtitle}>Voice-powered expense tracker</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Phase 0 — Build OK</Text>
      </View>
      <Text style={styles.hint}>
        Tap the mic, say an expense.{'\n'}
        e.g. "gym 500 rupees paid"
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#7c83fd',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 16,
    color: '#a0a0b0',
    marginTop: 8,
    marginBottom: 32,
  },
  badge: {
    backgroundColor: '#1e3a2f',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 32,
  },
  badgeText: {
    color: '#4ade80',
    fontSize: 13,
    fontWeight: '600',
  },
  hint: {
    fontSize: 14,
    color: '#60607a',
    textAlign: 'center',
    lineHeight: 22,
  },
});
