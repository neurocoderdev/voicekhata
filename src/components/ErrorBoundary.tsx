import { Component, type ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = { children: ReactNode };
type State = { error: Error | null };

// Catches render/runtime errors anywhere below it so a single bad render shows a
// recoverable screen instead of a white screen (release) or red box (dev). The
// only escape hatch is "Try again", which clears the error and re-renders the
// tree — enough for transient failures; a persistent one simply re-trips.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.warn('[ErrorBoundary] caught render error:', error?.message ?? error);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <View style={styles.root}>
          <Text style={styles.emoji}>😕</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>
            The app hit an unexpected error. Your saved expenses are safe. Tap below to continue.
          </Text>
          <TouchableOpacity style={styles.btn} onPress={this.reset} activeOpacity={0.85}>
            <Text style={styles.btnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f0f1a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emoji: { fontSize: 44, marginBottom: 16 },
  title: { color: '#e8e8f0', fontSize: 20, fontWeight: '800', marginBottom: 10 },
  body: { color: '#8888aa', fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 24 },
  btn: {
    backgroundColor: '#7c83fd',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 40,
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
