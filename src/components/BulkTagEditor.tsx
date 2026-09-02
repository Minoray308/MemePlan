import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useStore } from '../state/StoreProvider';
import { useTheme } from '../hooks/useTheme';
import { useToast } from './ToastProvider';

interface Props {
  visible: boolean;
  stickerIds: string[];
  onClose: () => void;
}

/** Bulk add / remove tags for the stickers selected in multi-select mode. */
export function BulkTagEditor({ visible, stickerIds, onClose }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const { stickers, allTags, addTagsToStickers, removeTagsFromStickers } = useStore();
  const [newTag, setNewTag] = useState('');

  const selected = useMemo(
    () => stickers.filter((s) => stickerIds.includes(s.id)),
    [stickers, stickerIds],
  );

  const availableTags = useMemo(() => {
    return Array.from(new Set([...allTags, ...stickers.flatMap((s) => s.tags)])).sort((a, b) =>
      a.localeCompare(b, 'zh'),
    );
  }, [allTags, stickers]);

  const allHave = (tag: string) => selected.length > 0 && selected.every((s) => s.tags.includes(tag));

  const toggleTag = (tag: string) => {
    if (allHave(tag)) {
      removeTagsFromStickers(stickerIds, [tag]);
      toast.info(`已从所选表情移除「${tag}」`);
    } else {
      addTagsToStickers(stickerIds, [tag]);
      toast.success(`已为所选表情添加「${tag}」`);
    }
  };

  const addNewTag = () => {
    const tag = newTag.trim();
    if (!tag) return;
    addTagsToStickers(stickerIds, [tag]);
    setNewTag('');
    toast.success(`已为所选表情添加「${tag}」`);
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.title, { color: theme.colors.text }]}>设置标签</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
            为选中的 {selected.length} 张表情批量添加或移除标签
          </Text>

          <View style={[styles.addRow, { backgroundColor: theme.colors.inputBackground }]}>
            <TextInput
              value={newTag}
              onChangeText={setNewTag}
              placeholder="输入新标签"
              placeholderTextColor={theme.colors.placeholder}
              style={[styles.input, { color: theme.colors.text }]}
              onSubmitEditing={addNewTag}
              returnKeyType="done"
            />
            <Pressable
              onPress={addNewTag}
              style={({ pressed }) => [
                styles.addBtn,
                { backgroundColor: theme.colors.primary },
                pressed && styles.pressed,
              ]}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>添加</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {availableTags.length === 0 ? (
              <Text style={[styles.empty, { color: theme.colors.textMuted }]}>暂无标签，先在上方添加一个吧</Text>
            ) : (
              availableTags.map((tag, index) => {
                const checked = allHave(tag);
                return (
                  <Pressable
                    key={tag}
                    onPress={() => toggleTag(tag)}
                    style={[
                      styles.row,
                      index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider },
                    ]}
                  >
                    <Text style={[styles.rowLabel, { color: theme.colors.text }]} numberOfLines={1}>
                      {tag}
                    </Text>
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: checked ? theme.colors.primary : theme.colors.textMuted,
                          backgroundColor: checked ? theme.colors.primary : 'transparent',
                        },
                      ]}
                    >
                      {checked && <Text style={styles.checkboxMark}>✓</Text>}
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          <Pressable onPress={onClose} style={[styles.done, { backgroundColor: theme.colors.primary }]}>
            <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>完成</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16, paddingBottom: 26, maxHeight: '78%' },
  title: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 12, textAlign: 'center', marginTop: 4, marginBottom: 12 },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    marginHorizontal: 16,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: 8 },
  addBtn: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  list: { marginTop: 10, marginHorizontal: 4 },
  empty: { textAlign: 'center', fontSize: 13, paddingVertical: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  rowLabel: { flex: 1, fontSize: 15, marginRight: 12 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxMark: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', lineHeight: 18 },
  done: { marginHorizontal: 20, marginTop: 12, paddingVertical: 13, borderRadius: 14, alignItems: 'center' },
  pressed: { opacity: 0.8 },
});
