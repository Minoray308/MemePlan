import { useEffect, useMemo, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../state/StoreProvider';
import { useTheme } from '../hooks/useTheme';
import { useToast } from './ToastProvider';
import { NameInputForm } from './NameInputForm';
import { SearchInput } from './SearchInput';

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
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    if (visible) { setNewTag(''); setQuery(''); setCreating(false); }
  }, [visible]);

  const selected = useMemo(
    () => stickers.filter((s) => stickerIds.includes(s.id)),
    [stickers, stickerIds],
  );

  const availableTags = useMemo(() => {
    return Array.from(new Set([...allTags, ...stickers.flatMap((s) => s.tags)])).sort((a, b) =>
      a.localeCompare(b, 'zh'),
    );
  }, [allTags, stickers]);

  const filteredTags = useMemo(() => availableTags.filter(tag => tag.toLowerCase().includes(query.trim().toLowerCase())), [availableTags, query]);

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
    if (!tag) { toast.error('请输入标签名称'); return; }
    addTagsToStickers(stickerIds, [tag]);
    Keyboard.dismiss();
    setNewTag('');
    setQuery('');
    setCreating(false);
    toast.success(`已为所选表情添加「${tag}」`);
  };

  const cancelCreate = () => {
    Keyboard.dismiss();
    setCreating(false);
    setNewTag('');
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={creating ? cancelCreate : onClose}>
      {creating ? <NameInputForm title="添加新标签" value={newTag} onChange={setNewTag} placeholder="输入新标签"
        confirmLabel="添加" onCancel={cancelCreate} onConfirm={addNewTag} /> : (
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.title, { color: theme.colors.text }]}>设置标签</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
            {selected.length === 1 ? '点击标签即可添加或移除，修改立即保存' : `为选中的 ${selected.length} 张表情添加或移除标签，修改立即保存`}
          </Text>

          <SearchInput value={query} onChangeText={setQuery} placeholder="搜索已有标签" />
          <Text style={{ color: theme.colors.textSecondary, marginHorizontal: 20, marginTop: 8 }}>已有标签（{filteredTags.length}）</Text>
          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {filteredTags.length === 0 ? (
              <Text style={[styles.empty, { color: theme.colors.textMuted }]}>{query.trim() ? '没有匹配的标签，可新建标签' : '暂无标签，点击下方新建标签'}</Text>
            ) : (
              filteredTags.map((tag, index) => {
                const checked = allHave(tag);
                const partial = !checked && selected.some(s => s.tags.includes(tag));
                return (
                  <Pressable
                    key={tag}
                    accessibilityRole="checkbox" accessibilityState={{ checked: partial ? 'mixed' : checked }}
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
                      {partial && <Text style={{ color: theme.colors.primary }}>−</Text>}
                    </View>
                  </Pressable>
                );
              })
            )}
          <Pressable onPress={() => { setCreating(true); setNewTag(query.trim()); }} style={{ padding: 14, marginHorizontal: 16 }}>
            <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>＋ 添加新标签</Text>
          </Pressable>
          </ScrollView>

          <Pressable onPress={onClose} style={[styles.done, { backgroundColor: theme.colors.primary }]}>
            <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>完成</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16, paddingBottom: 26, maxHeight: '78%' },
  title: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 12, textAlign: 'center', marginTop: 4, marginBottom: 12 },
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
});
