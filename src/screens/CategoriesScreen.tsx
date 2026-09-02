import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, BackHandler, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useStore } from '../state/StoreProvider';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../components/ToastProvider';
import { useSelection } from '../hooks/useSelection';
import { TabNavigationProp } from '../navigation/types';
import { ScreenHeader } from '../components/ScreenHeader';
import { StickerGrid } from '../components/StickerGrid';
import { EmptyState } from '../components/EmptyState';
import { Icon, CategoryIcon } from '../components/Icon';
import { SelectionBar } from '../components/SelectionBar';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { NameInputForm } from '../components/NameInputForm';
import { SearchInput } from '../components/SearchInput';
import { CategoryPicker } from '../components/CategoryPicker';
import { ImportSourceSheet } from '../components/ImportSourceSheet';
import { exportStickers } from '../services/shareService';
import { saveStickersToGallery } from '../services/saveService';
import { MediaPermissionError, type ImportSourceKey } from '../services/importService';
import { getChildren, countStickersByCategory, getVisibleChildren, searchCategories, getCategoryPath, getDescendantIds } from '../utils/category';
import type { Category as CategoryModel } from '../models/types';

type Props = { navigation: TabNavigationProp<'Categories'> };

export function CategoriesScreen({ navigation }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const {
    stickers,
    categories,
    settings,
    loaded,
    importFromLibrary,
    importFromFiles,
    importFromClipboard,
    touchSticker,
    deleteStickers,
    moveStickersToCategory,
    createCategory,
    renameCategory,
    deleteCategory,
  } = useStore();

  const selection = useSelection();
  const { selectMode, selectedIds, exitSelection } = selection;

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [categoryQuery, setCategoryQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [manageTarget, setManageTarget] = useState<CategoryModel | null>(null);
  const [renameTarget, setRenameTarget] = useState<CategoryModel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryModel | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showDeleteCat, setShowDeleteCat] = useState(false);
  const [showDeleteStickers, setShowDeleteStickers] = useState(false);
  const [showCategoryPick, setShowCategoryPick] = useState(false);
  const [childrenExpanded, setChildrenExpanded] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSource, setImportSource] = useState<ImportSourceKey | null>(null);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });

  const currentCategory = useMemo(
    () => categories.find((c) => c.id === currentFolderId) || null,
    [categories, currentFolderId],
  );

  const topLevel = useMemo(() => getChildren(categories, null), [categories]);
  const childFolders = useMemo(
    () => (currentFolderId ? getChildren(categories, currentFolderId) : []),
    [categories, currentFolderId],
  );
  const searchResults = useMemo(() => {
    const scope = currentFolderId ? new Set(getDescendantIds(currentFolderId, categories).slice(1)) : null;
    return searchCategories(scope ? categories.filter(c => scope.has(c.id)) : categories, categoryQuery);
  }, [categories, currentFolderId, categoryQuery]);
  const displayedTopLevel = categoryQuery.trim() ? searchResults : topLevel;
  const visibleChildFolders = useMemo(
    () => categoryQuery.trim() ? searchResults : getVisibleChildren(childFolders, childrenExpanded),
    [childFolders, childrenExpanded, categoryQuery, searchResults],
  );

  useEffect(() => {
    setChildrenExpanded(false);
  }, [currentFolderId]);

  const directStickers = useMemo(
    () => stickers.filter((s) => s.categoryId === currentFolderId),
    [stickers, currentFolderId],
  );

  const selectedStickers = useMemo(
    () => stickers.filter((s) => selectedIds.has(s.id)),
    [stickers, selectedIds],
  );

  const countByCategory = useMemo(() => countStickersByCategory(stickers, categories), [stickers, categories]);

  const confirmCreate = useCallback(() => {
    if (!createName.trim()) {
      toast.error('请输入分类名称');
      return;
    }
    createCategory(createName.trim(), currentFolderId, 'folder-outline');
    setCreateName('');
    setShowCreate(false);
    toast.success(currentFolderId ? '子分类已创建' : '分类已创建');
  }, [createName, createCategory, currentFolderId, toast]);

  const confirmApplyCategory = useCallback(
    (categoryId: string | null) => {
      if (!selectedStickers.length) return;
      moveStickersToCategory(Array.from(selectedIds), categoryId);
      exitSelection();
      setShowCategoryPick(false);
      toast.success('已更新分类');
    },
    [selectedStickers.length, selectedIds, moveStickersToCategory, exitSelection, toast],
  );

  const runImport = useCallback(
    async (source: ImportSourceKey) => {
      if (!currentFolderId) return;
      setImporting(true);
      setImportSource(source);
      setImportProgress({ done: 0, total: 0 });
      try {
        const onProgress = (_picked: number, done: number, total: number) =>
          setImportProgress({ done, total });
        const options = { multiple: true, onProgress, categoryId: currentFolderId };
        const result =
          source === 'library'
            ? await importFromLibrary(options)
            : source === 'files'
              ? await importFromFiles(options)
              : await importFromClipboard(options);

        const message: string[] = [];
        if (result.imported.length) message.push(`已添加 ${result.imported.length} 张`);
        if (result.duplicates) message.push(`跳过 ${result.duplicates} 张重复`);
        if (result.failed) message.push(`${result.failed} 张失败`);
        if (message.length) toast.success(message.join('，'));
        else if (source === 'clipboard') toast.info('剪贴板中没有图片');
        else toast.info('没有可添加的图片');
      } catch (error) {
        console.warn('[categories] import failed', error);
        if (error instanceof MediaPermissionError) toast.error('需要相册权限才能添加');
        else if (source === 'clipboard') toast.error('添加失败，请检查剪贴板内容');
        else toast.error('添加失败，请重试');
      } finally {
        setImporting(false);
        setImportSource(null);
        setImportProgress({ done: 0, total: 0 });
      }
    },
    [currentFolderId, importFromLibrary, importFromFiles, importFromClipboard, toast],
  );

  const handleSelectImport = useCallback(
    (source: ImportSourceKey) => {
      setShowImport(false);
      void runImport(source);
    },
    [runImport],
  );

  const handleSaveToAlbum = useCallback(async () => {
    if (!selectedStickers.length) return;
    try {
      const outcome = await saveStickersToGallery(selectedStickers);
      if (outcome.ok) {
        toast.success(outcome.saved === outcome.total ? `已保存 ${outcome.saved} 张到相册` : `已保存 ${outcome.saved}/${outcome.total} 张`);
      } else if (outcome.reason === 'denied') {
        toast.error('需要相册权限才能保存');
      } else if (outcome.reason === 'unavailable') {
        toast.error('当前设备不支持保存到相册');
      } else {
        toast.error('保存失败，请重试');
      }
    } catch (e) {
      console.warn(e);
      toast.error('保存失败');
    } finally {
      exitSelection();
    }
  }, [selectedStickers, toast, exitSelection]);

  const handleExport = useCallback(async () => {
    try {
      selectedStickers.forEach((s) => touchSticker(s.id));
      const outcome = await exportStickers(selectedStickers);
      if (outcome.reason === 'gif_unsupported') {
        toast.error('包含动图，无法批量导出');
      } else if (!outcome.ok) {
        toast.error(outcome.reason === 'unavailable' ? '当前设备不支持导出' : '导出失败');
      } else {
        toast.success('已打开导出面板');
      }
    } catch (e) {
      console.warn(e);
      toast.error('导出失败');
    } finally {
      exitSelection();
    }
  }, [selectedStickers, touchSticker, toast, exitSelection]);

  const openCategory = useCallback((cat: CategoryModel) => {
    setCategoryQuery('');
    setCurrentFolderId(cat.id);
  }, []);

  const goBack = useCallback(() => {
    setCategoryQuery('');
    setCurrentFolderId(currentCategory?.parentId ?? null);
  }, [currentCategory]);

  useFocusEffect(
    useCallback(() => {
      if (!currentFolderId) return;
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        goBack();
        return true;
      });
      return () => subscription.remove();
    }, [currentFolderId, goBack]),
  );

  const openRename = useCallback((cat: CategoryModel) => {
    setRenameTarget(cat);
    setRenameValue(cat.name);
    setManageTarget(null);
  }, []);

  const openDeleteCategory = useCallback((cat: CategoryModel) => {
    setDeleteTarget(cat);
    setShowDeleteCat(true);
    setManageTarget(null);
  }, []);

  // ---------------------------------------------------------------- folder view
  if (currentFolderId) {
    return (
      <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
        <ScreenHeader
          title={currentCategory?.name || '分类'}
          subtitle={`${childFolders.length} 个子分类 · ${directStickers.length} 张表情`}
          right={
            <Pressable onPress={goBack} style={[styles.headerBtn, { backgroundColor: theme.colors.inputBackground }]}>
              <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '700' }}>返回</Text>
            </Pressable>
          }
        />

        <SearchInput value={categoryQuery} onChangeText={setCategoryQuery} placeholder="搜索此文件夹下的分类" />

        <View style={styles.gridWrap}>
          <StickerGrid
            stickers={directStickers}
            columns={settings.gridColumns}
            selectMode={selectMode}
            selectedIds={selectedIds}
            showFormatLabel={settings.showFormatLabel}
            animateGifs={settings.animateGifs}
            onOpenSticker={(s) => {
              if (selectMode) selection.toggle(s.id);
              else navigation.navigate('Detail', { stickerId: s.id });
            }}
            onLongPress={(s) => selection.enterSelection(s.id)}
            onDragSelect={selection.toggleForDrag}
            ListHeaderComponent={
              <View style={styles.folderHeader}>
                <View style={styles.sectionHeading}>
                  <Text style={[styles.sectionLabel, { color: theme.colors.textMuted }]}>子分类</Text>
                  {!categoryQuery.trim() && childFolders.length > 4 && (
                    <Pressable onPress={() => setChildrenExpanded((expanded) => !expanded)} hitSlop={8}>
                      <Text style={[styles.expandText, { color: theme.colors.primary }]}>
                        {childrenExpanded ? '收起' : `展开全部 (${childFolders.length})`}
                      </Text>
                    </Pressable>
                  )}
                </View>
                <View style={styles.folderRow}>
                  {visibleChildFolders.map((child) => (
                    <Pressable
                      key={child.id}
                      onPress={() => openCategory(child)}
                      style={[styles.folderChip, { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder }]}
                    >
                      <CategoryIcon icon={child.icon} size={18} />
                      <Text style={[styles.folderChipText, { color: theme.colors.text }]}>{categoryQuery.trim() ? getCategoryPath(child.id, categories).map(c => c.name).join(' / ') : child.name}</Text>
                    </Pressable>
                  ))}
                  {visibleChildFolders.length === 0 && (
                    <Text style={{ color: theme.colors.textMuted, paddingVertical: 12 }}>{categoryQuery.trim() ? '没有匹配的分类' : '暂无子分类'}</Text>
                  )}
                </View>
                <View style={styles.folderActions}>
                  <Pressable onPress={() => setShowImport(true)} style={[styles.folderActionBtn, { backgroundColor: theme.colors.primary }]}>
                    <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>＋ 添加表情包</Text>
                  </Pressable>
                  <Pressable onPress={() => setShowCreate(true)} style={[styles.folderActionBtn, { backgroundColor: theme.colors.primarySoft }]}>
                    <Text style={{ color: theme.colors.primary, fontSize: 14, fontWeight: '700' }}>新建子分类</Text>
                  </Pressable>
                </View>
              </View>
            }
            ListEmptyComponent={
              <EmptyState icon='folder-multiple-outline' title="这个分类还没有表情包" message="可以在这里导入或移动表情包" />
            }
          />
        </View>

        {selectMode && (
          <SelectionBar
            count={selectedIds.size}
            onClose={exitSelection}
            actions={[
                { key: 'save', icon: 'download-outline', label: '存相册', onPress: handleSaveToAlbum },
                { key: 'export', icon: 'export-variant', label: '导出', onPress: handleExport },
              { key: 'move', icon: 'folder-move-outline', label: '分类', onPress: () => setShowCategoryPick(true) },
              { key: 'delete', icon: 'delete-outline', label: '删除', onPress: () => setShowDeleteStickers(true) },
            ]}
          />
        )}

        <ConfirmDialog
          visible={showDeleteStickers}
          title="删除表情包"
          message={`确定删除选中的 ${selectedStickers.length} 张吗？`}
          confirmLabel="删除"
          danger
          onConfirm={() => {
            deleteStickers(Array.from(selectedIds));
            toast.success(`已删除 ${selectedStickers.length} 张`);
            exitSelection();
            setShowDeleteStickers(false);
          }}
          onCancel={() => setShowDeleteStickers(false)}
        />

        <CategoryPicker
          visible={showCategoryPick}
          categories={categories}
          selectedId={selectedStickers.length > 0 && selectedStickers.every(s => s.categoryId === selectedStickers[0].categoryId) ? selectedStickers[0].categoryId : null}
          onApply={confirmApplyCategory}
          onClose={() => setShowCategoryPick(false)}
          title="移动到分类"
        />

        <ImportSourceSheet
          visible={showImport}
          onClose={() => setShowImport(false)}
          onSelect={handleSelectImport}
        />

        <Modal transparent visible={importing} animationType="fade">
          <View style={styles.importOverlay}>
            <View style={[styles.importCard, { backgroundColor: theme.colors.card }]}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text style={[styles.importTitle, { color: theme.colors.text }]}>
                {importProgress.total > 0
                  ? '正在添加表情包…'
                  : importSource === 'files'
                    ? '正在打开文件…'
                    : importSource === 'clipboard'
                      ? '正在读取剪贴板…'
                      : '正在打开相册…'}
              </Text>
              <Text style={[styles.importSub, { color: theme.colors.textSecondary }]}>
                {importProgress.total > 0 ? `${importProgress.done} / ${importProgress.total}` : '请选择图片'}
              </Text>
            </View>
          </View>
        </Modal>

        <CreateCategoryModal
          visible={showCreate}
          value={createName}
          onChange={setCreateName}
          title="新建子分类"
          placeholder="输入子分类名称"
          onCancel={() => setShowCreate(false)}
          onConfirm={confirmCreate}
        />
        <RenameCategoryModal
          target={renameTarget}
          value={renameValue}
          onChange={setRenameValue}
          onClose={() => setRenameTarget(null)}
          onConfirm={() => {
            if (renameTarget && renameValue.trim()) {
              renameCategory(renameTarget.id, renameValue);
              toast.success('已重命名');
            }
            setRenameTarget(null);
          }}
        />
        <ConfirmDialog
          visible={showDeleteCat}
          title="删除分类"
          message="删除后，该分类及其所有子分类都会被删除，其中的表情会变为未分类。确定删除吗？"
          confirmLabel="删除"
          danger
          onConfirm={() => {
            if (deleteTarget) deleteCategory(deleteTarget.id);
            setShowDeleteCat(false);
            setDeleteTarget(null);
            if (currentCategory?.id === deleteTarget?.id) setCurrentFolderId(null);
            toast.success('分类已删除');
          }}
          onCancel={() => {
            setShowDeleteCat(false);
            setDeleteTarget(null);
          }}
        />
      </View>
    );
  }

  // ---------------------------------------------------------------- root view
  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScreenHeader
        title="分类"
        subtitle={`${topLevel.length} 个分类`}
        right={
          <Pressable onPress={() => setShowCreate(true)} style={[styles.headerBtn, { backgroundColor: theme.colors.primary }]}>
            <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>＋ 新建</Text>
          </Pressable>
        }
      />

      <SearchInput value={categoryQuery} onChangeText={setCategoryQuery} placeholder="搜索全部分类（含子分类）" />

      {!loaded ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {displayedTopLevel.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => openCategory(c)}
              onLongPress={() => setManageTarget(c)}
              style={[styles.catRow, { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder }]}
            >
              <View style={[styles.catIcon, { backgroundColor: theme.colors.primarySoft }]}>
                <CategoryIcon icon={c.icon} size={24} color={theme.colors.primary} />
              </View>
              <View style={styles.catInfo}>
                <Text style={[styles.catName, { color: theme.colors.text }]}>{c.name}</Text>
                {!!categoryQuery.trim() && <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{getCategoryPath(c.id, categories).map(folder => folder.name).join(' / ')}</Text>}
                <Text style={[styles.catCount, { color: theme.colors.textMuted }]}>
                  {countByCategory[c.id] || 0} 张表情 · {getChildren(categories, c.id).length} 个子分类
                </Text>
              </View>
              <Text style={{ color: theme.colors.textMuted }}>›</Text>
            </Pressable>
          ))}
          {displayedTopLevel.length === 0 && (
            <EmptyState icon='folder-multiple-outline' title={categoryQuery.trim() ? "没有匹配的分类" : "还没有分类"} message={categoryQuery.trim() ? "试试其他关键词" : "点击右上角新建一个文件夹分类吧"} />
          )}
        </ScrollView>
      )}

      {manageTarget && (
        <View style={styles.manageSheetWrap}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setManageTarget(null)} />
          <View style={[styles.manageSheet, { backgroundColor: theme.colors.card, paddingBottom: 24 }]}>
            <Text style={[styles.manageTitle, { color: theme.colors.text }]}>{manageTarget.name}</Text>
            <View style={styles.manageRow}>
              <Pressable onPress={() => openRename(manageTarget)} style={[styles.manageItem, { backgroundColor: theme.colors.inputBackground }]}>
                <Icon name="pencil-outline" size={20} color={theme.colors.textSecondary} />
                <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '600' }}>重命名</Text>
              </Pressable>
              <Pressable onPress={() => openDeleteCategory(manageTarget)} style={[styles.manageItem, { backgroundColor: theme.colors.inputBackground }]}>
                <Icon name="delete-outline" size={20} color={theme.colors.danger} />
                <Text style={{ color: theme.colors.danger, fontSize: 14, fontWeight: '600' }}>删除分类</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      <CreateCategoryModal
        visible={showCreate}
        value={createName}
        onChange={setCreateName}
        title="新建分类"
        placeholder="输入分类名称"
        onCancel={() => setShowCreate(false)}
        onConfirm={confirmCreate}
      />
      <RenameCategoryModal
        target={renameTarget}
        value={renameValue}
        onChange={setRenameValue}
        onClose={() => setRenameTarget(null)}
        onConfirm={() => {
          if (renameTarget && renameValue.trim()) {
            renameCategory(renameTarget.id, renameValue);
            toast.success('已重命名');
          }
          setRenameTarget(null);
        }}
      />
      <ConfirmDialog
        visible={showDeleteCat}
        title="删除分类"
        message="删除后，该分类及其所有子分类都会被删除，其中的表情会变为未分类。确定删除吗？"
        confirmLabel="删除"
        danger
        onConfirm={() => {
          if (deleteTarget) deleteCategory(deleteTarget.id);
          setShowDeleteCat(false);
          setDeleteTarget(null);
          toast.success('分类已删除');
        }}
        onCancel={() => {
          setShowDeleteCat(false);
          setDeleteTarget(null);
        }}
      />
    </View>
  );
}

function CreateCategoryModal({
  visible,
  value,
  onChange,
  title,
  placeholder,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  value: string;
  onChange: (v: string) => void;
  title: string;
  placeholder: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <NameInputForm title={title} value={value} onChange={onChange} placeholder={placeholder}
        onCancel={onCancel} onConfirm={onConfirm} />
    </Modal>
  );
}

function RenameCategoryModal({
  target,
  value,
  onChange,
  onClose,
  onConfirm,
}: {
  target: CategoryModel | null;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const theme = useTheme();
  return (
    <Modal transparent visible={target !== null} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.modalCard, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>重命名分类</Text>
          <TextInput
            value={value}
            onChangeText={onChange}
            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
            placeholder="输入新的名称"
            placeholderTextColor={theme.colors.placeholder}
            autoFocus
            onSubmitEditing={onConfirm}
          />
          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={[styles.modalBtn, { backgroundColor: theme.colors.inputBackground }]}>
              <Text style={{ color: theme.colors.textSecondary }}>取消</Text>
            </Pressable>
            <Pressable onPress={onConfirm} style={[styles.modalBtn, { backgroundColor: theme.colors.primary }]}>
              <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>保存</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  gridWrap: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
  list: { padding: 16, gap: 12 },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  catIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  catInfo: { flex: 1, marginLeft: 12 },
  catName: { fontSize: 16, fontWeight: '700' },
  catCount: { fontSize: 13, marginTop: 2 },
  folderHeader: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionLabel: { fontSize: 12, fontWeight: '700' },
  expandText: { fontSize: 13, fontWeight: '700' },
  folderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center', paddingBottom: 10 },
  folderChip: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 84,
  },
  folderChipText: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  folderActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  folderActionBtn: { flex: 1, alignItems: 'center', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 10 },
  importOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  importCard: { paddingHorizontal: 36, paddingVertical: 28, borderRadius: 20, alignItems: 'center' },
  importTitle: { fontSize: 16, fontWeight: '700', marginTop: 14 },
  importSub: { fontSize: 13, marginTop: 6 },
  manageSheetWrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'flex-end' },
  manageSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16 },
  manageTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 14 },
  manageRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20 },
  manageItem: { flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: 14, gap: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  modalCard: { width: '100%', maxWidth: 320, borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: '700', marginBottom: 14, textAlign: 'center' },
  input: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  modalActions: { flexDirection: 'row', marginTop: 16, gap: 10 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center' },
});
