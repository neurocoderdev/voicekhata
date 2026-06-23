import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = {
  isModelLoaded: boolean;
  isListening: boolean;
  isTtsSpeaking: boolean;
  onPress: () => void;
};

const BUTTON_SIZE = 88;
const RING_SIZE = BUTTON_SIZE + 32;

export function MicButton({ isModelLoaded, isListening, isTtsSpeaking, onPress }: Props) {
  // Single animated value for the pulse ring — scale from 1 → 1.35 → 1.
  const ringScale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isListening) {
      ringOpacity.setValue(0.55);
      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(ringScale, {
            toValue: 1.36,
            duration: 750,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(ringScale, {
            toValue: 1,
            duration: 750,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      loopRef.current.start();
    } else {
      loopRef.current?.stop();
      loopRef.current = null;
      // Snap back immediately — no fade-out animation that could linger.
      ringScale.setValue(1);
      ringOpacity.setValue(0);
    }

    return () => {
      loopRef.current?.stop();
    };
  }, [isListening, ringScale, ringOpacity]);

  const isDisabled = !isModelLoaded || isTtsSpeaking;
  const buttonColor = isListening ? '#e05260' : isDisabled ? '#2e2e50' : '#7c83fd';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={styles.wrapper}
      accessibilityLabel={isListening ? 'Stop listening' : 'Start listening'}
      accessibilityRole="button"
    >
      {/* Pulse ring — rendered only when listening, driven by useNativeDriver */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          { transform: [{ scale: ringScale }], opacity: ringOpacity },
        ]}
      />

      {/* Main circle */}
      <View style={[styles.circle, { backgroundColor: buttonColor }]}>
        {!isModelLoaded ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : isListening ? (
          <StopIcon />
        ) : (
          <MicIcon />
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────
// Implemented as plain View shapes — no icon library dependency, no SVG overhead.

function MicIcon() {
  return (
    <View style={iconStyles.micRoot}>
      <View style={iconStyles.micCapsule} />
      <View style={iconStyles.micArm} />
      <View style={iconStyles.micPost} />
      <View style={iconStyles.micBase} />
    </View>
  );
}

function StopIcon() {
  return <View style={iconStyles.stopSquare} />;
}

const W = '#ffffff';

const iconStyles = StyleSheet.create({
  micRoot: { alignItems: 'center', gap: 2 },
  micCapsule: { width: 13, height: 22, borderRadius: 7, backgroundColor: W },
  micArm: {
    width: 22,
    height: 11,
    borderBottomLeftRadius: 11,
    borderBottomRightRadius: 11,
    borderWidth: 2.5,
    borderTopWidth: 0,
    borderColor: W,
  },
  micPost: { width: 2.5, height: 5, backgroundColor: W },
  micBase: { width: 14, height: 2.5, borderRadius: 1.5, backgroundColor: W },
  stopSquare: { width: 22, height: 22, borderRadius: 4, backgroundColor: W },
});

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2.5,
    borderColor: '#e05260',
  },
  circle: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
});
