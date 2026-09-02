import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../state/StoreProvider';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../components/ToastProvider';
import { RootStackParamList } from '../navigation/types';
import { StickerImage } from '../components/StickerImage';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CategoryPicker } from '../components/CategoryPicker';
import { Icon, CategoryIcon } from '../components/Icon';
import { exportSticker } from '../services/shareService';
import { formatDate, formatFileSize } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'Detail'>;

export function DetailScreen({ navigation, route }: Props) {
  const { stickerId } = route.params;
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const {
    stickers,
    categories,
    toggleFavorite,
    touchSticker,
    renameSticker,
    setStickerCategory,
    setStickerTags,
    deleteStickers,
  } = useStore();

  const sticker = useMemo(() => stickers.find((s) => s.id === stickerId), [stickers, stickerId]);

  const [showRename, setShowRename] = useState(false);
  const [renameText, setRenameText] = useState('');
  const [showCategory, setShowCategory] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [tagsText, setTagsText] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (sticker) touchSticker(sticker.id);
    // update last-used time once the sticker is available
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sticker?.id]);

  const openRename = useCallback(() => {
    if (!sticker) return;
    setRenameText(sticker.name);
    setShowRename(true);
  }, [sticker]);

  const confirmRename = useCallback(() => {
    if (!sticker || !renameText.trim()) return;
    renameSticker(sticker.id, renameText);
    setShowRename(false);
    toast.success('已重命名');
  }, [sticker, renameText, renameSticker, toast]);

  const openTags = useCallback(() => {
    if (!sticker) return;
    setTagsText(sticker.tags.join(', '));
    setShowTags(true);
  }, [sticker]);

  const confirmTags = useCallback(() => {
    if (!sticker) return;
    const tags = Array.from(
      new Set(
        tagsText
          .split(/[,，]/)
          .map((t) => t.trim())
          .filter(Boolean),
      ),
    ).slice(0, 10);
    setStickerTags(sticker.id, tags);
    setShowTags(false);
    toast.success('标签已更新');
  }, [sticker, tagsText, setStickerTags, toast]);

  const handleExport = useCallback(async () => {
    if (!sticker) return;
    setSharing(true);
    try {
      touchSticker(sticker.id);
      const outcome = await exportSticker(sticker);
      if (!outcome.ok && outcome.reason !== 'error') toast.error('当前设备不支持导出');
      else toast.success('已打开导出面板');
    } catch (e) {
      console.warn(e);
      toast.error('导出失败');
    } finally {
      setSharing(false);
    }
  }, [sticker, touchSticker, toast]);

  const handleDelete = useCallback(() => {
    if (!sticker) return;
    deleteStickers([sticker.id]);
    setShowDelete(false);
    toast.success('表情包已删除');
    navigation.goBack();
  }, [sticker, deleteStickers, toast, navigation]);

  if (!sticker) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  const stickerCategory = categories.find((c) => c.id === sticker.categoryId) || null;

  const infoRows: { label: string; value: string }[] = [
    { label: '添加时间', value: formatDate(sticker.createdAt) },
    { label: '文件大小', value: formatFileSize(sticker.fileSize) },
    { label: '格式', value: sticker.fileType.toUpperCase() },
  ];

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 6, borderBottomColor: theme.colors.divider }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={[styles.topBtn, { backgroundColor: theme.colors.inputBackground }]}>
          <Text style={styles.topBtnText}>‹</Text>
        </Pressable>
        <Text style={[styles.topTitle, { color: theme.colors.text }]} numberOfLines={1}>
          表情详情
        </Text>
        <View style={styles.topBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.previewWrap}>
          <StickerImage uri={sticker.localUri} style={styles.preview} contentFit="contain" showIndicator />
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder }]}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: theme.colors.text }]}>{sticker.name}</Text>
            <Pressable onPress={openRename} hitSlop={8} style={[styles.nameEdit, { backgroundColor: theme.colors.inputBackground }]}>
              <Icon name="pencil-outline" size={16} color={theme.colors.textSecondary} />
            </Pressable>
            <Pressable
              onPress={() => toggleFavorite(sticker.id)}
              style={[styles.favBtn, { backgroundColor: sticker.isFavorite ? theme.colors.primarySoft : theme.colors.inputBackground }]}
            >
              <Icon name={sticker.isFavorite ? 'star' : 'star-outline'} size={22} color={sticker.isFavorite ? theme.colors.favorite : theme.colors.textSecondary} />
            </Pressable>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.divider }]} />

          <Pressable style={styles.infoRow} onPress={() => setShowCategory(true)}>
            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>分类</Text>
            <View style={styles.valueWrap}>
              {!stickerCategory ? (
                <Text style={{ color: theme.colors.textMuted }}>未分类</Text>
              ) : (
                <View style={styles.tagWrap}>
                  <View style={[styles.tag, { backgroundColor: theme.colors.primarySoft }]}>
                    <CategoryIcon icon={stickerCategory.icon} size={13} color={theme.colors.primary} />
                    <Text style={{ color: theme.colors.primary, fontSize: 12, fontWeight: '600', marginLeft: 4 }}>{stickerCategory.name}</Text>
                  </View>
                </View>
              )}
              <Text style={{ color: theme.colors.textMuted }}>›</Text>
            </View>
          </Pressable>

          <Pressable style={styles.infoRow} onPress={openTags}>
            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>标签</Text>
            <View style={styles.valueWrap}>
              {sticker.tags.length === 0 ? (
                <Text style={{ color: theme.colors.textMuted }}>未设置</Text>
              ) : (
                <View style={styles.tagWrap}>
                  {sticker.tags.map((tag) => (
                    <View key={tag} style={[styles.tag, { backgroundColor: theme.colors.inputBackground }]}>
                      <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>#{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
              <Text style={{ color: theme.colors.textMuted }}>›</Text>
            </View>
          </Pressable>

          {infoRows.map((r) => (
            <View key={r.label} style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>{r.label}</Text>
              <Text style={[styles.infoValue, { color: theme.colors.text }]}>{r.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actionsRow}>
          <Pressable onPress={handleExport} style={[styles.action, { backgroundColor: theme.colors.primary }]}>
            <Icon name="export-variant" size={22} color="#FFFFFF" />
            <Text style={styles.actionText}>导出</Text>
          </Pressable>
          <Pressable onPress={() => setShowDelete(true)} style={[styles.action, { backgroundColor: theme.colors.inputBackground }]}>
            <Icon name="delete-outline" size={22} color={theme.colors.danger} />
            <Text style={[styles.actionTextLocal, { color: theme.colors.danger }]}>删除</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Rename modal */}
      <Modal transparent visible={showRename} animationType="fade" onRequestClose={() => setShowRename(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowRename(false)} />
          <View style={[styles.modalCard, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>重命名</Text>
            <TextInput
              value={renameText}
              onChangeText={setRenameText}
              style={[styles.renameInput, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
              autoFocus
              placeholder="输入名称"
              placeholderTextColor={theme.colors.placeholder}
              onSubmitEditing={confirmRename}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setShowRename(false)} style={[styles.modalBtn, { backgroundColor: theme.colors.inputBackground }]}>
                <Text style={{ color: theme.colors.textSecondary }}>取消</Text>
              </Pressable>
              <Pressable onPress={confirmRename} style={[styles.modalBtn, { backgroundColor: theme.colors.primary }]}>
                <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>保存</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Tags modal */}
      <Modal transparent visible={showTags} animationType="fade" onRequestClose={() => setShowTags(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowTags(false)} />
          <View style={[styles.modalCard, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>编辑标签</Text>
            <TextInput
              value={tagsText}
              onChangeText={setTagsText}
              style={[styles.renameInput, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
              autoFocus
              placeholder="用逗号分隔，例如：猫, 搞笑"
              placeholderTextColor={theme.colors.placeholder}
              onSubmitEditing={confirmTags}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setShowTags(false)} style={[styles.modalBtn, { backgroundColor: theme.colors.inputBackground }]}>
                <Text style={{ color: theme.colors.textSecondary }}>取消</Text>
              </Pressable>
              <Pressable onPress={confirmTags} style={[styles.modalBtn, { backgroundColor: theme.colors.primary }]}>
                <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>保存</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <CategoryPicker
        visible={showCategory}
        categories={categories}
        selectedId={sticker.categoryId}
        onApply={(categoryId) => {
          setStickerCategory(sticker.id, categoryId);
          setShowCategory(false);
          toast.success('分类已更新');
        }}
        onClose={() => setShowCategory(false)}
      />

      <ConfirmDialog
        visible={showDelete}
        title="删除表情包"
        message="确定要删除这张表情包吗？此操作不可恢复。"
        confirmLabel="删除"
        danger
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />

      <Modal transparent visible={sharing} animationType="fade">
        <View style={styles.modalOverlay}>
          <ActivityIndicator color="#fff" />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  topBtnText: { fontSize: 30, color: '#555', lineHeight: 32 },
  topBtnEmoji: { fontSize: 16 },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  previewWrap: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    marginBottom: 14,
  },
  preview: { width: '100%', aspectRatio: 1 },
  card: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { flex: 1, fontSize: 18, fontWeight: '700', marginRight: 8 },
  nameEdit: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  favBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9 },
  infoLabel: { fontSize: 14 },
  infoValue: { fontSize: 14, fontWeight: '600' },
  valueWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flexShrink: 1, justifyContent: 'flex-end' },
  tag: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'center' },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  action: { flex: 1, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  actionEmoji: { fontSize: 20 },
  actionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', marginTop: 4 },
  actionTextLocal: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  modalCard: { width: '100%', maxWidth: 320, borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: '700', marginBottom: 14, textAlign: 'center' },
  renameInput: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  modalActions: { flexDirection: 'row', marginTop: 16, gap: 10 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center' },
});
