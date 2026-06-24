import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

type Props = {
  visible: boolean;
  // Initial text to populate the editor — the recognized transcript, or '' when
  // the user opened it via "Type here".
  initialText: string;
  // Heading shown above the editor ("Confirm command" vs "Type a command").
  title: string;
  onSubmit: (text: string) => void;
  onCancel: () => void;
};

export function CommandEditorModal({ visible, initialText, title, onSubmit, onCancel }: Props) {
  const [text, setText] = useState(initialText);

  // Re-seed the field every time the modal opens with new content.
  useEffect(() => {
    if (visible) setText(initialText);
  }, [visible, initialText]);

  const trimmed = text.trim();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.sheet}
            >
              <Text style={styles.title}>{title}</Text>
              <TextInput
                style={styles.input}
                value={text}
                onChangeText={setText}
                placeholder='e.g. gym 500 rupees paid'
                placeholderTextColor={C.dim}
                autoFocus
                multiline
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.actions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.75}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitBtn, !trimmed && styles.submitDisabled]}
                  onPress={() => trimmed && onSubmit(trimmed)}
                  disabled={!trimmed}
                  activeOpacity={0.85}
                >
                  <Text style={styles.submitText}>Submit</Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const C = {
  backdrop: 'rgba(0,0,0,0.6)',
  surface: '#1a1a2e',
  surfaceHigh: '#0f0f1a',
  border: '#2a2a4e',
  accent: '#7c83fd',
  muted: '#a0a0b0',
  dim: '#60607a',
  white: '#e8e8f0',
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: C.backdrop,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 20,
  },
  title: { color: C.white, fontSize: 16, fontWeight: '700', marginBottom: 14 },
  input: {
    backgroundColor: C.surfaceHigh,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.white,
    fontSize: 16,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 18 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10 },
  cancelText: { color: C.muted, fontSize: 15, fontWeight: '600' },
  submitBtn: {
    backgroundColor: C.accent,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  submitDisabled: { backgroundColor: '#2e2e50' },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
