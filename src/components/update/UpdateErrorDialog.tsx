import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import type { ApkUpdateError } from '../../services/update/updateTypes';

interface Props {
  visible: boolean;
  error: ApkUpdateError | null;
  onLater: () => void;
  onRetry: () => void;
}

/** Shown when an update fails — the app keeps running on the current version. */
export function UpdateErrorDialog({ visible, error, onLater, onRetry }: Props) {
  const theme = useTheme();
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onLater}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onLater} />
        <View style={[styles.dialog, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.title, { color: theme.colors.text }]}>更新失败</Text>
          <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
            {error?.message ?? '更新失败，请稍后重试'}
          </Text>
          <View style={styles.actions}>
            <Pressable
              onPress={onLater}
              style={[styles.btn, { backgroundColor: theme.colors.inputBackground }]}
            >
              <Text style={[styles.btnText, { color: theme.colors.text }]}>稍后再说</Text>
            </Pressable>
            <Pressable onPress={onRetry} style={[styles.btn, { backgroundColor: theme.colors.primary }]}>
              <Text style={[styles.btnText, styles.btnPrimaryText]}>重试</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  dialog: { width: '100%', maxWidth: 320, borderRadius: 20, padding: 22 },
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  message: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  actions: { flexDirection: 'row', marginTop: 18 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center', marginHorizontal: 4 },
  btnText: { fontSize: 15, fontWeight: '600' },
  btnPrimaryText: { color: '#FFFFFF' },
});
