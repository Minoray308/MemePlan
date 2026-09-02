import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { Icon, type AppIconName } from './Icon';
import { importSourceOptions, type ImportSourceKey } from '../services/importService';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (source: ImportSourceKey) => void;
}

const SOURCE_META: Record<ImportSourceKey, { icon: AppIconName; title: string; description: string }> = {
  library: { icon: 'image-multiple-outline', title: '从相册导入', description: '选择一张或多张系统相册图片' },
  files: { icon: 'folder-open-outline', title: '从文件导入', description: '浏览设备中的图片文件' },
  clipboard: { icon: 'clipboard-outline', title: '从剪贴板', description: '粘贴当前剪贴板中的图片' },
};

export function ImportSourceSheet({ visible, onClose, onSelect }: Props) {
  const theme = useTheme();
  const sources = importSourceOptions();

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.title, { color: theme.colors.text }]}>导入表情包</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>选择图片来源</Text>
          {sources.map((source) => {
            const meta = SOURCE_META[source.key];
            return (
              <Pressable
                key={source.key}
                disabled={!source.available}
                onPress={() => onSelect(source.key)}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: theme.colors.inputBackground, opacity: source.available ? (pressed ? 0.75 : 1) : 0.4 },
                ]}
              >
                <Icon name={meta.icon} size={24} color={theme.colors.primary} />
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: theme.colors.text }]}>{meta.title}</Text>
                  <Text style={[styles.rowDescription, { color: theme.colors.textSecondary }]}>{meta.description}</Text>
                </View>
                <Text style={{ color: theme.colors.textMuted, fontSize: 18 }}>›</Text>
              </Pressable>
            );
          })}
          <Pressable onPress={onClose} style={[styles.cancel, { backgroundColor: theme.colors.inputBackground }]}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 15, fontWeight: '600' }}>取消</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  title: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  rowText: { flex: 1, marginLeft: 12 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowDescription: { fontSize: 12, marginTop: 2 },
  cancel: { borderRadius: 16, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
});
