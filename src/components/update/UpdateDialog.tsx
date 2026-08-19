import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import type { AppUpdateInfo } from '../../services/update/updateTypes';

interface Props {
  info: AppUpdateInfo;
  /** Forced update (current < minimumVersion) — cannot be dismissed. */
  force?: boolean;
  onLater: () => void;
  onUpdate: () => void;
}

/**
 * "发现新版本" dialog.
 * - Normal updates: [稍后] closes it and the app keeps running; [立即更新]
 *   starts the update.
 * - Forced updates: only [立即更新] is shown (current < minimumVersion), so
 *   the user must install the newer build to keep using the app.
 */
export function UpdateDialog({ info, force = false, onLater, onUpdate }: Props) {
  const theme = useTheme();
  return (
    <Modal transparent visible animationType="fade" onRequestClose={force ? () => {} : onLater}>
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={force ? () => {} : onLater}
        />
        <View style={[styles.dialog, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {force ? '需要更新才能继续使用' : `发现新版本 v${info.version}`}
          </Text>
          {!!info.changelog && (
            <ScrollView style={styles.changelogWrap} bounces={false}>
              <Text style={[styles.changelog, { color: theme.colors.textSecondary }]}>
                {info.changelog}
              </Text>
            </ScrollView>
          )}
          <View style={styles.actions}>
            {!force && (
              <Pressable
                onPress={onLater}
                style={[styles.btn, { backgroundColor: theme.colors.inputBackground }]}
              >
                <Text style={[styles.btnText, { color: theme.colors.text }]}>稍后</Text>
              </Pressable>
            )}
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
  changelogWrap: { maxHeight: 180 },
  changelog: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  actions: { flexDirection: 'row', marginTop: 18 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center', marginHorizontal: 4 },
  btnText: { fontSize: 15, fontWeight: '600' },
  btnPrimaryText: { color: '#FFFFFF' },
});