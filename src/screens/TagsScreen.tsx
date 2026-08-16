import React, { useCallback, useMemo, useState } from 'react';
import { BackHandler, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useStore } from '../state/StoreProvider';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../components/ToastProvider';
import { TabNavigationProp } from '../navigation/types';
import { ScreenHeader } from '../components/ScreenHeader';
import { StickerGrid } from '../components/StickerGrid';
import { EmptyState } from '../components/EmptyState';
import { Icon } from '../components/Icon';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { Sticker } from '../models/types';

interface TagStat {
  tag: string;
  count: number;
}

type Props = { navigation: TabNavigationProp<'Tags'> };

export function TagsScreen({ navigation }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const { stickers, settings, allTags, createTag, renameTag, deleteTag } = useStore();

  const [query, setQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createValue, setCreateValue] = useState('');

  const tags = useMemo<TagStat[]>(() => {
    const map = new Map<string, number>();
    allTags.forEach((tag) => map.set(tag, map.get(tag) || 0));
    stickers.forEach((s) => {
      s.tags.forEach((tag) => map.set(tag, (map.get(tag) || 0) + 1));
    });
    const q = query.trim().toLowerCase();
    return Array.from(map.entries())
      .map(([tag, count]) => ({ tag, count }))
      .filter((item) => !q || item.tag.toLowerCase().includes(q))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'zh'));
  }, [stickers, allTags, query]);

  const tagStickers = useMemo(
    () => stickers.filter((s) => selectedTag && s.tags.includes(selectedTag)),
    [stickers, selectedTag],
  );

  const closeTagDetail = useCallback(() => {
    setSelectedTag(null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!selectedTag) return;
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        closeTagDetail();
        return true;
      });
      return () => subscription.remove();
    }, [selectedTag, closeTagDetail]),
  );

  const openEditor = (tag: string) => {
    setEditingTag(tag);
    setEditValue(tag);
  };

  const confirmRename = () => {
    if (!editingTag) return;
    const next = editValue.trim();
    if (!next) {
      toast.error('标签名不能为空');
      return;
    }
    renameTag(editingTag, next);
    toast.success('标签已重命名');
    setEditingTag(null);
  };

  const confirmCreate = () => {
    const next = createValue.trim();
    if (!next) {
      toast.error('请输入标签名');
      return;
    }
    const exists = allTags.includes(next) || stickers.some((s) => s.tags.includes(next));
    if (exists) {
      toast.info('标签已存在');
      return;
    }
    createTag(next);
    toast.success('标签已创建');
    setCreateValue('');
    setShowCreate(false);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteTag(deleteTarget);
    toast.success('标签已删除');
    setDeleteTarget(null);
    if (selectedTag === deleteTarget) setSelectedTag(null);
  };

  // ---------------------------------------------------------------- tag detail
  if (selectedTag) {
    return (
      <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
        <ScreenHeader
          title={`#${selectedTag}`}
          subtitle={`${tagStickers.length} 张表情`}
          right={
            <Pressable onPress={() => setSelectedTag(null)} style={[styles.backBtn, { backgroundColor: theme.colors.inputBackground }]}>
              <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '700' }}>返回</Text>
            </Pressable>
          }
        />
        <View style={styles.gridWrap}>
          <StickerGrid
            stickers={tagStickers}
            columns={settings.gridColumns}
            selectMode={false}
            selectedIds={new Set()}
            showFormatLabel={settings.showFormatLabel}
            animateGifs={settings.animateGifs}
            onOpenSticker={(s: Sticker) => navigation.navigate('Detail', { stickerId: s.id })}
            onLongPress={() => {}}
            ListEmptyComponent={<EmptyState icon='tag-multiple-outline' title="这个标签下还没有表情包" message="去表情详情页添加这个标签吧" />}
          />
        </View>
      </View>
    );
  }

  // ---------------------------------------------------------------- tag list
  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScreenHeader
        title="标签"
        subtitle={`${tags.length} 个标签`}
        right={
          <Pressable onPress={() => setShowCreate(true)} style={[styles.newTagBtn, { backgroundColor: theme.colors.primary }]}>
            <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>＋ 新建</Text>
          </Pressable>
        }
      />

      <View style={styles.searchRow}>
        <View style={[styles.searchBox, { backgroundColor: theme.colors.inputBackground }]}>
          <Icon name="magnify" size={16} color={theme.colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="搜索标签"
            placeholderTextColor={theme.colors.placeholder}
            style={[styles.searchInput, { color: theme.colors.text }]}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Text style={{ color: theme.colors.textMuted, fontSize: 16 }}>×</Text>
            </Pressable>
          )}
        </View>
      </View>

      {tags.length === 0 ? (
        <EmptyState icon='tag-multiple-outline' title={query ? '没有找到相关标签' : '还没有标签'} message={query ? '换个关键词试试吧' : '在表情详情页点击「标签」即可添加标签'} />
      ) : (
        <ScrollView contentContainerStyle={styles.grid}>
          {tags.map((item) => (
            <View key={item.tag} style={styles.tagWrap}>
              <Pressable
                onPress={() => setSelectedTag(item.tag)}
                style={[styles.tagCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder }]}
              >
                <Text style={[styles.tagName, { color: theme.colors.text }]} numberOfLines={1}>
                  {item.tag}
                </Text>
                <Text style={[styles.tagCount, { color: theme.colors.textMuted }]}>{item.count} 张表情</Text>
              </Pressable>
              <Pressable onPress={() => openEditor(item.tag)} hitSlop={6} style={[styles.editBtn, { backgroundColor: theme.colors.inputBackground }]}>
                <Icon name="pencil-outline" size={16} color={theme.colors.textSecondary} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal transparent visible={showCreate} animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowCreate(false)} />
          <View style={[styles.modalCard, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>新建标签</Text>
            <TextInput
              value={createValue}
              onChangeText={setCreateValue}
              style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
              placeholder="输入标签名"
              placeholderTextColor={theme.colors.placeholder}
              autoFocus
              onSubmitEditing={confirmCreate}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setShowCreate(false)} style={[styles.modalBtn, { backgroundColor: theme.colors.inputBackground }]}>
                <Text style={{ color: theme.colors.textSecondary }}>取消</Text>
              </Pressable>
              <Pressable onPress={confirmCreate} style={[styles.modalBtn, { backgroundColor: theme.colors.primary }]}>
                <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>创建</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={editingTag !== null} animationType="fade" onRequestClose={() => setEditingTag(null)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditingTag(null)} />
          <View style={[styles.modalCard, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>编辑标签</Text>
            <TextInput
              value={editValue}
              onChangeText={setEditValue}
              style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
              placeholder="输入标签名"
              placeholderTextColor={theme.colors.placeholder}
              autoFocus
              onSubmitEditing={confirmRename}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setEditingTag(null)} style={[styles.modalBtn, { backgroundColor: theme.colors.inputBackground }]}>
                <Text style={{ color: theme.colors.textSecondary }}>取消</Text>
              </Pressable>
              <Pressable onPress={confirmRename} style={[styles.modalBtn, { backgroundColor: theme.colors.primary }]}>
                <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>保存</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => {
                setDeleteTarget(editingTag);
                setEditingTag(null);
              }}
              style={[styles.deleteBtn, { backgroundColor: theme.colors.inputBackground }]}
            >
              <Text style={{ color: theme.colors.danger, fontWeight: '600' }}>删除标签</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={deleteTarget !== null}
        title="删除标签"
        message={`确定删除「${deleteTarget || ''}」标签吗？只会移除表情上的标签，不会删除表情。`}
        confirmLabel="删除"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  gridWrap: { flex: 1 },
  searchRow: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 14, height: 42, gap: 8 },
  searchIcon: { fontSize: 15 },
  searchInput: { flex: 1, fontSize: 15 },
  backBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
  newTagBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    padding: 16,
  },
  tagWrap: { width: '31%', position: 'relative' },
  tagCard: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  tagName: { fontSize: 14, fontWeight: '700', maxWidth: '100%' },
  tagCount: { fontSize: 12, marginTop: 4 },
  editBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  modalCard: { width: '100%', maxWidth: 320, borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: '700', marginBottom: 14, textAlign: 'center' },
  input: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  modalActions: { flexDirection: 'row', marginTop: 16, gap: 10 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center' },
  deleteBtn: { marginTop: 12, paddingVertical: 12, borderRadius: 14, alignItems: 'center' },
});
