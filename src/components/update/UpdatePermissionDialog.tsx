import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface Props {
  visible: boolean;
  onOpenSettings: () => void;
  onLater: () => void;
}

/**
 * Shown when Android refuses to let the app install packages. Guides the user
 * to the system "allow installing unknown apps" screen — never auto-navigates.
 */
export function UpdatePermissionDialog({ visible, onOpenSettings, onLater }: Props) {
  const theme = useTheme();
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onLater}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onLater} />
        <View style={[styles.dialog, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.title, { color: theme.colors.text }]}>需要安装权限</Text>
          <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
            为了完成版本更新，需要允许此应用安装更新。
          </Text>
          <View style={styles.actions}>
            <Pressable
              onPress={onLater}
              style={[styles.btn, { backgroundColor: theme.colors.inputBackground }]}
            >
              <Text style={[styles.btnText, { color: theme.colors.text }]}>稍后再说</Text>
            </Pressable>
            <Pressable
              onPress={onOpenSettings}
              style={[styles.btn, { backgroundColor: theme.colors.primary }]}
            >
              <Text style={[styles.btnText, styles.btnPrimaryText]}>去设置</Text>
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
