import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import type { AppUpdateInfo } from '../../services/update/updateTypes';

interface Props {
  info: AppUpdateInfo;
  onLater: () => void;
  onUpdate: () => void;
}

/**
 * Non-blocking "发现新版本" dialog.
 * [稍后] closes it and the app keeps running; [立即更新] starts the update.
 */
export function UpdateDialog({ info, onLater, onUpdate }: Props) {
  const theme = useTheme();
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onLater}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onLater} />
        <View style={[styles.dialog, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.title, { color: theme.colors.text }]}>发现新版本 v{info.version}</Text>
          {!!info.changelog && (
            <ScrollView style={styles.changelogWrap} bounces={false}>
              <Text style={[styles.changelog, { color: theme.colors.textSecondary }]}>
                {info.changelog}
              </Text>
            </ScrollView>
          )}
          <View style={styles.actions}>
            <Pressable
              onPress={onLater}
              style={[styles.btn, { backgroundColor: theme.colors.inputBackground }]}
            >
              <Text style={[styles.btnText, { color: theme.colors.text }]}>稍后</Text>
            </Pressable>
            <Pressable onPress={onUpdate} style={[styles.btn, { backgroundColor: theme.colors.primary }]}>
              <Text style={[styles.btnText, styles.btnPrimaryText]}>立即更新</Text>
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
  dialog: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 20,
    padding: 22,
  },
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  version: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  changelogWrap: { maxHeight: 180 },
  changelog: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  actions: { flexDirection: 'row', marginTop: 18 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center', marginHorizontal: 4 },
  btnText: { fontSize: 15, fontWeight: '600' },
  btnPrimaryText: { color: '#FFFFFF' },
});




