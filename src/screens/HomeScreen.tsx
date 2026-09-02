import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Modal, ActivityIndicator } from 'react-native';
import { useStore } from '../state/StoreProvider';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../components/ToastProvider';
import { useSelection } from '../hooks/useSelection';
import { useFocusEffect } from '@react-navigation/native';
import { TabNavigationProp } from '../navigation/types';
import { ScreenHeader } from '../components/ScreenHeader';
import { StickerGrid } from '../components/StickerGrid';
import { EmptyState } from '../components/EmptyState';
import { Icon, CategoryIcon, type AppIconName } from '../components/Icon';
import { SelectionBar } from '../components/SelectionBar';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CategoryPicker } from '../components/CategoryPicker';
import { ImportSourceSheet } from '../components/ImportSourceSheet';
import { BulkTagEditor } from '../components/BulkTagEditor';
import { exportStickers } from '../services/shareService';
import { saveStickersToGallery } from '../services/saveService';
import { StickerOverlayService } from '../services/stickerOverlayService';
import { MediaPermissionError, type ImportSourceKey } from '../services/importService';
import { getChildren, getDescendantIds, searchStickers } from '../utils/category';
import { VIRTUAL_CATEGORY_IDS } from '../constants';
import { OVERLAY_FILTER_OPTIONS, tagFromOverlayKey } from '../constants/overlay';
import type { Sticker } from '../models/types';

type Props = { navigation: TabNavigationProp<'Home'> };

const { all: CAT_ALL, recents: CAT_RECENTS, favorites: CAT_FAVORITES } = VIRTUAL_CATEGORY_IDS;

interface FilterOption {
  value: string;
  label: string;
}

interface FilterGroup {
  key: string;
  label: string;
  icon: AppIconName;
  options: FilterOption[];
}

function toggleSet(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

const STATIC_FILTER_GROUPS: FilterGroup[] = [
  {
    key: 'time',
    label: '时间',
    icon: 'clock-outline',
    options: [
      { value: 'all', label: '全部时间' },
      { value: '7d', label: '最近 7 天' },
      { value: '30d', label: '最近 30 天' },
      { value: '1y', label: '最近 1 年' },
    ],
  },
  {
    key: 'format',
    label: '格式',
    icon: 'image-multiple-outline',
    options: [
      { value: 'all', label: '全部格式' },
      { value: 'png', label: 'PNG' },
      { value: 'jpg', label: 'JPG' },
      { value: 'gif', label: 'GIF' },
      { value: 'webp', label: 'WEBP' },
      { value: 'heic', label: 'HEIC' },
      { value: 'other', label: '其他' },
    ],
  },
  {
    key: 'size',
    label: '大小',
    icon: 'resize',
    options: [
      { value: 'all', label: '全部大小' },
      { value: 'small', label: '小于 100KB' },
      { value: 'medium', label: '100KB - 1MB' },
      { value: 'large', label: '大于 1MB' },
    ],
  },
  {
    key: 'tags',
    label: '标签',
    icon: 'tag-outline',
    options: [
      { value: 'all', label: '全部标签' },
      { value: 'tagged', label: '有标签' },
      { value: 'untagged', label: '无标签' },
    ],
  },
];

export function HomeScreen({ navigation }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const {
    stickers,
    categories,
    allTags,
    settings,
    loaded,
    importFromLibrary,
    importFromFiles,
    importFromClipboard,
    touchSticker,
    deleteStickers,
    moveStickersToCategory,
  } = useStore();

  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>(CAT_ALL);
  const [importing, setImporting] = useState(false);
  const [importSource, setImportSource] = useState<ImportSourceKey | null>(null);
  const [progress, setProgress] = useState({ picked: 0, done: 0, total: 0 });
  const [showImport, setShowImport] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showTagEdit, setShowTagEdit] = useState(false);
  const [showCategory, setShowCategory] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [sortValue, setSortValue] = useState<'time_desc' | 'time_asc' | 'size_desc' | 'size_asc'>('time_desc');
  const [expandedFilter, setExpandedFilter] = useState<string | null>(null);
  const [filterTimes, setFilterTimes] = useState<Set<string>>(new Set());
  const [filterFormats, setFilterFormats] = useState<Set<string>>(new Set());
  const [filterSizes, setFilterSizes] = useState<Set<string>>(new Set());
  const [filterTags, setFilterTags] = useState<Set<string>>(new Set());
  const [overlayOpen, setOverlayOpen] = useState(false);

  // Keep the floating-window button in sync with the native overlay.
  useEffect(() => {
    const sub = StickerOverlayService.addListener('onClosed', () => setOverlayOpen(false));
    return () => sub.remove();
  }, []);

  const selection = useSelection();
  const { selectMode, selectedIds, exitSelection } = selection;

  // Android hardware back cancels multi-select instead of leaving the app.
  useFocusEffect(
    React.useCallback(() => {
      if (!selectMode) return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        exitSelection();
        return true;
      });
      return () => sub.remove();
    }, [selectMode, exitSelection]),
  );

  const topLevelCategories = useMemo(() => getChildren(categories, null), [categories]);

  const availableTags = useMemo(() => {
    return Array.from(new Set([...allTags, ...stickers.flatMap((s) => s.tags)])).sort((a, b) =>
      a.localeCompare(b, 'zh'),
    );
  }, [allTags, stickers]);

  // category id -> name, so the floating window can search by category too.
  const categoryNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of categories) map[c.id] = c.name;
    return map;
  }, [categories]);

  const activeFilterCount = useMemo(() => {
    return (
      filterTimes.size +
      filterFormats.size +
      filterSizes.size +
      filterTags.size
    );
  }, [filterTimes, filterFormats, filterSizes, filterTags]);

  const sortedStickers = useMemo(() => {
    return [...stickers].sort((a, b) => {
      if (sortValue === 'time_asc') return a.createdAt - b.createdAt;
      if (sortValue === 'size_desc') return b.fileSize - a.fileSize || b.createdAt - a.createdAt;
      if (sortValue === 'size_asc') return a.fileSize - b.fileSize || b.createdAt - a.createdAt;
      return b.createdAt - a.createdAt;
    });
  }, [stickers, sortValue]);

  const visible = useMemo(() => {
    let list = sortedStickers;

    if (activeCategory === CAT_RECENTS) {
      list = list.filter((s) => s.lastUsedAt != null);
    } else if (activeCategory === CAT_FAVORITES) {
      list = list.filter((s) => s.isFavorite);
    } else if (activeCategory !== CAT_ALL) {
      const categoryIds = new Set(getDescendantIds(activeCategory, categories));
      list = list.filter((s) => s.categoryId && categoryIds.has(s.categoryId));
    }

    list = searchStickers(list, categories, query);

    if (filterTimes.size) {
      const values = Array.from(filterTimes);
      const now = Date.now();
      const ranges: Record<string, number> = { '7d': 7 * 86400000, '30d': 30 * 86400000, '1y': 365 * 86400000 };
      list = list.filter((s) => values.some((v) => s.createdAt >= now - (ranges[v] || 0)));
    }

    if (filterFormats.size) {
      const values = Array.from(filterFormats);
      list = list.filter((s) =>
        values.some((v) =>
          v === 'other'
            ? !['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic'].includes(s.fileType)
            : s.fileType === v,
        ),
      );
    }

    if (filterSizes.size) {
      const values = Array.from(filterSizes);
      list = list.filter((s) =>
        values.some((v) => {
          if (v === 'small') return s.fileSize < 100 * 1024;
          if (v === 'medium') return s.fileSize >= 100 * 1024 && s.fileSize <= 1024 * 1024;
          return s.fileSize > 1024 * 1024;
        }),
      );
    }

    if (filterTags.size) {
      const values = Array.from(filterTags);
      list = list.filter((s) =>
        values.some((v) => {
          if (v === 'tagged') return s.tags.length > 0;
          if (v === 'untagged') return s.tags.length === 0;
          return s.tags.includes(v);
        }),
      );
    }

    return list;
  }, [sortedStickers, activeCategory, query, categories, filterTimes, filterFormats, filterSizes, filterTags]);

  const runImport = useCallback(
    async (source: ImportSourceKey) => {
      setImporting(true);
      setImportSource(source);
      setProgress({ picked: 0, done: 0, total: 0 });
      try {
        const onProgress = (picked: number, done: number, total: number) =>
          setProgress({ picked: picked || 0, done, total });
        const result =
          source === 'library'
            ? await importFromLibrary({ multiple: true, onProgress })
            : source === 'files'
              ? await importFromFiles({ multiple: true, onProgress })
              : await importFromClipboard({ onProgress });

        const msg: string[] = [];
        if (result.imported.length) msg.push(`已导入 ${result.imported.length} 张`);
        if (result.duplicates) msg.push(`跳过 ${result.duplicates} 张重复`);
        if (result.failed) msg.push(`${result.failed} 张失败`);
        if (msg.length) toast.success(msg.join('，'));
        else if (source === 'clipboard') toast.info('剪贴板中没有图片');
        else toast.info('没有可导入的图片');
      } catch (e) {
        console.warn('[home] import failed', e);
        if (e instanceof MediaPermissionError) toast.error('需要相册权限才能导入');
        else if (source === 'clipboard') toast.error('导入失败，请检查剪贴板内容');
        else toast.error('导入失败，请重试');
      } finally {
        setImporting(false);
        setImportSource(null);
        setProgress({ picked: 0, done: 0, total: 0 });
      }
    },
    [importFromLibrary, importFromFiles, importFromClipboard, toast],
  );

  const handleImportPress = useCallback(() => setShowImport(true), []);
  const handleSelectImport = useCallback(
    (source: ImportSourceKey) => {
      setShowImport(false);
      runImport(source);
    },
    [runImport],
  );

  const handleOpen = useCallback(
    (sticker: Sticker) => navigation.navigate('Detail', { stickerId: sticker.id }),
    [navigation],
  );

  const handleLongPress = useCallback((sticker: Sticker) => {
    selection.enterSelection(sticker.id);
  }, [selection]);

  const onGridPress = useCallback(
    (sticker: Sticker) => {
      if (selectMode) selection.toggle(sticker.id);
      else handleOpen(sticker);
    },
    [selectMode, selection, handleOpen],
  );

  const selectedStickers = useMemo(
    () => stickers.filter((s) => selectedIds.has(s.id)),
    [stickers, selectedIds],
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
    if (!selectedStickers.length) return;
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

  const requestOverlayPermission = useCallback(async (): Promise<boolean> => {
    try {
      const granted = await StickerOverlayService.canDrawOverlays();
      if (granted) return true;
      Alert.alert(
        '开启悬浮窗权限',
        '“快速发送”需要“显示在其他应用上层”权限。请在系统设置中允许本应用显示悬浮窗，然后返回本应用再次点击。',
        [
          { text: '取消', style: 'cancel' },
          {
            text: '去开启',
            onPress: () => {
              StickerOverlayService.openOverlaySettings().catch(() => {});
            },
          },
        ],
      );
      return false;
    } catch (e) {
      console.warn('[home] check overlay permission failed', e);
      return false;
    }
  }, []);

  const openOverlay = useCallback(
    async (stickersForOverlay: Sticker[]) => {
      if (Platform.OS !== 'android' || !StickerOverlayService.isAvailable()) {
        toast.error('当前预览版不支持悬浮窗，请使用安装版');
        return;
      }
      const granted = await requestOverlayPermission();
      if (!granted) return;
      try {
        const activeTags = new Set([...allTags, ...stickers.flatMap((s) => s.tags)]);
        const safeFilters = settings.overlayFilters.filter((key) => {
          const tag = tagFromOverlayKey(key);
          return tag === null
            ? OVERLAY_FILTER_OPTIONS.some((o) => o.key === key)
            : activeTags.has(tag);
        });
        const ok = await StickerOverlayService.showOverlay(stickersForOverlay, categoryNames, safeFilters, theme.colors.primary);
        if (ok) {
          setOverlayOpen(true);
          if (settings.exitAfterOverlay) {
            // The overlay is a system window: finish the activity right away
            // and let the window stay on screen.
            setTimeout(() => BackHandler.exitApp(), 100);
          }
        } else {
          toast.error('打开悬浮窗失败，请重试');
        }
      } catch (e) {
        console.warn('[home] open overlay failed', e);
        toast.error('打开悬浮窗失败');
      }
    },
    [theme.colors.primary, toast, requestOverlayPermission, categoryNames, settings.overlayFilters, settings.exitAfterOverlay, allTags, stickers],
  );

  const handleToggleOverlay = useCallback(() => {
    if (overlayOpen) {
      StickerOverlayService.hideOverlay().catch(() => {});
      setOverlayOpen(false);
      return;
    }
    openOverlay(stickers);
  }, [overlayOpen, stickers, openOverlay]);

  const handleOverlaySendSelected = useCallback(() => {
    if (!selectedStickers.length) return;
    openOverlay(selectedStickers);
  }, [selectedStickers, openOverlay]);

  const handleBulkDelete = useCallback(() => {
    deleteStickers(Array.from(selectedIds));
    toast.success(`已删除 ${selectedStickers.length} 张表情`);
    exitSelection();
    setShowDelete(false);
  }, [selectedIds, selectedStickers.length, deleteStickers, toast, exitSelection]);

  const applyCategory = useCallback(
    (categoryId: string | null) => {
      if (!selectedStickers.length) return;
      moveStickersToCategory(Array.from(selectedIds), categoryId);
      setShowCategory(false);
      exitSelection();
      toast.success('已更新分类');
    },
    [selectedStickers.length, selectedIds, moveStickersToCategory, exitSelection, toast],
  );

  const toggleFilter = useCallback((key: string, value: string) => {
    if (value === 'all') {
      if (key === 'time') setFilterTimes(new Set());
      if (key === 'format') setFilterFormats(new Set());
      if (key === 'size') setFilterSizes(new Set());
      if (key === 'tags') setFilterTags(new Set());
      return;
    }

    if (key === 'time') setFilterTimes((prev) => toggleSet(prev, value));
    if (key === 'format') setFilterFormats((prev) => toggleSet(prev, value));
    if (key === 'size') setFilterSizes((prev) => toggleSet(prev, value));
    if (key === 'tags') {
      setFilterTags((prev) => {
        if (value === 'tagged' || value === 'untagged') return new Set([value]);
        const next = prev.has('tagged') || prev.has('untagged') ? new Set<string>() : new Set(prev);
        if (next.has(value)) next.delete(value);
        else next.add(value);
        return next;
      });
      return;
    }
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilterTimes(new Set());
    setFilterFormats(new Set());
    setFilterSizes(new Set());
    setFilterTags(new Set());
  }, []);

  const emptyTitle = query || activeFilterCount > 0
    ? '没有符合条件的表情包'
    : activeCategory === CAT_FAVORITES
      ? '还没有收藏'
      : activeCategory === CAT_RECENTS
        ? '还没有使用记录'
        : '还没有表情包';
  const emptyMessage = query || activeFilterCount > 0
    ? '换个筛选条件试试吧'
    : activeCategory === CAT_ALL
      ? '导入一些表情包开始使用吧'
      : '这个分类下还没有表情包';
  const showImportEmpty = activeCategory === CAT_ALL && !query && activeFilterCount === 0;

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScreenHeader
        title={'Meme\nPlan'}
        titleStyle={styles.brandTitle}
        subtitle={`共 ${stickers.length} 张`}
        right={
          <>
            <Pressable
              onPress={handleToggleOverlay}
              style={[styles.overlayBtn, { backgroundColor: overlayOpen ? theme.colors.primary : theme.colors.inputBackground }]}
              accessibilityLabel={overlayOpen ? '关闭悬浮窗' : '打开悬浮窗'}
            >
              <Text style={[styles.overlayBtnText, { color: overlayOpen ? '#FFFFFF' : theme.colors.text }]}>悬浮</Text>
            </Pressable>
            <Pressable onPress={() => setShowSort(true)} style={[styles.sortBtn, { backgroundColor: theme.colors.inputBackground }]}>
              <Text style={[styles.sortBtnText, { color: theme.colors.text }]}>排序</Text>
            </Pressable>
            <Pressable onPress={() => setShowFilter(true)} style={[styles.filterBtn, { backgroundColor: theme.colors.inputBackground }]}>
              <Text style={[styles.filterBtnText, { color: theme.colors.text }]} numberOfLines={1}>
                筛选{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}
              </Text>
            </Pressable>
            <Pressable onPress={handleImportPress} style={[styles.importBtn, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.importText}>导入</Text>
            </Pressable>
          </>
        }
      />

      <View style={styles.searchRow}>
        <View style={[styles.searchBox, { backgroundColor: theme.colors.inputBackground }]}>
          <Icon name="magnify" size={16} color={theme.colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="搜索名称、分类或标签"
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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipContent}
      >
        {[
          { id: CAT_ALL, name: '全部', icon: 'image-multiple-outline' },
          { id: CAT_RECENTS, name: '最近', icon: 'clock-outline' },
          { id: CAT_FAVORITES, name: '收藏', icon: 'star' },
          ...topLevelCategories,
        ].map((c) => {
          const active = activeCategory === c.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => setActiveCategory(c.id)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? theme.colors.primary : theme.colors.card,
                  borderColor: theme.colors.cardBorder,
                },
              ]}
            >
              <CategoryIcon icon={c.icon} size={16} color={active ? '#FFFFFF' : theme.colors.textSecondary} />
              <Text style={[styles.chipText, { color: active ? '#fff' : theme.colors.text }]}>{c.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.gridWrap}>
        {!loaded ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : (
          <StickerGrid
            stickers={visible}
            columns={settings.gridColumns}
            selectMode={selectMode}
            selectedIds={selectedIds}
            showFormatLabel={settings.showFormatLabel}
            animateGifs={settings.animateGifs}
            onOpenSticker={onGridPress}
            onLongPress={handleLongPress}
            onDragSelect={selection.toggleForDrag}
            ListEmptyComponent={
              <EmptyState
                icon={query || activeFilterCount > 0 ? 'magnify' : 'image-multiple-outline'}
                title={emptyTitle}
                message={emptyMessage}
                actionLabel={showImportEmpty ? '导入表情包' : undefined}
                onAction={showImportEmpty ? handleImportPress : undefined}
              />
            }
          />
        )}
      </View>

      {selectMode && (
        <SelectionBar
          count={selectedIds.size}
          onClose={exitSelection}
          actions={[
            { key: 'save', icon: 'download-outline', label: '存相册', onPress: handleSaveToAlbum },
            { key: 'export', icon: 'export-variant', label: '导出', onPress: handleExport },
            { key: 'overlay', icon: 'picture-in-picture-bottom-right-outline', label: '悬浮窗', onPress: handleOverlaySendSelected },
            { key: 'move', icon: 'folder-move-outline', label: '分类', onPress: () => setShowCategory(true) },
            { key: 'tags', icon: 'tag-multiple-outline', label: '标签', onPress: () => setShowTagEdit(true) },
            { key: 'delete', icon: 'delete-outline', label: '删除', onPress: () => setShowDelete(true) },
          ]}
        />
      )}

      <ConfirmDialog
        visible={showDelete}
        title="删除表情包"
        message={`确定要删除选中的 ${selectedStickers.length} 张表情包吗？此操作不可恢复。`}
        confirmLabel="删除"
        danger
        onConfirm={handleBulkDelete}
        onCancel={() => setShowDelete(false)}
      />

      <CategoryPicker
        visible={showCategory}
        categories={categories}
        selectedId={selectedStickers.length > 0 && selectedStickers.every(s => s.categoryId === selectedStickers[0].categoryId) ? selectedStickers[0].categoryId : null}
        onApply={applyCategory}
        onClose={() => setShowCategory(false)}
        title="设置所选表情的分类"
      />

      <ImportSourceSheet visible={showImport} onClose={() => setShowImport(false)} onSelect={handleSelectImport} />

      <BulkTagEditor
        visible={showTagEdit}
        stickerIds={Array.from(selectedIds)}
        onClose={() => setShowTagEdit(false)}
      />

      <Modal transparent visible={showSort} animationType="fade" onRequestClose={() => setShowSort(false)}>
        <View style={styles.sortOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowSort(false)} />
          <View style={[styles.sortSheet, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.sortTitle, { color: theme.colors.text }]}>排序</Text>
            <View style={styles.sortRow}>
              <Text style={[styles.sortGroup, { color: theme.colors.textSecondary }]}>时间</Text>
              <Pressable
                onPress={() => { setSortValue('time_desc'); setShowSort(false); }}
                style={[styles.sortOption, { backgroundColor: sortValue === 'time_desc' ? theme.colors.primary : theme.colors.inputBackground }]}
              >
                <Text style={{ color: sortValue === 'time_desc' ? '#FFFFFF' : theme.colors.text, fontWeight: '600' }}>新 → 旧</Text>
              </Pressable>
              <Pressable
                onPress={() => { setSortValue('time_asc'); setShowSort(false); }}
                style={[styles.sortOption, { backgroundColor: sortValue === 'time_asc' ? theme.colors.primary : theme.colors.inputBackground }]}
              >
                <Text style={{ color: sortValue === 'time_asc' ? '#FFFFFF' : theme.colors.text, fontWeight: '600' }}>旧 → 新</Text>
              </Pressable>
            </View>
            <View style={styles.sortRow}>
              <Text style={[styles.sortGroup, { color: theme.colors.textSecondary }]}>大小</Text>
              <Pressable
                onPress={() => { setSortValue('size_desc'); setShowSort(false); }}
                style={[styles.sortOption, { backgroundColor: sortValue === 'size_desc' ? theme.colors.primary : theme.colors.inputBackground }]}
              >
                <Text style={{ color: sortValue === 'size_desc' ? '#FFFFFF' : theme.colors.text, fontWeight: '600' }}>大 → 小</Text>
              </Pressable>
              <Pressable
                onPress={() => { setSortValue('size_asc'); setShowSort(false); }}
                style={[styles.sortOption, { backgroundColor: sortValue === 'size_asc' ? theme.colors.primary : theme.colors.inputBackground }]}
              >
                <Text style={{ color: sortValue === 'size_asc' ? '#FFFFFF' : theme.colors.text, fontWeight: '600' }}>小 → 大</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={showFilter} animationType="fade" onRequestClose={() => setShowFilter(false)}>
        <View style={styles.filterOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowFilter(false)} />
          <View style={[styles.filterSheet, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.filterTitle, { color: theme.colors.text }]}>筛选条件</Text>
            {STATIC_FILTER_GROUPS.map((group) => {
              const expanded = expandedFilter === group.key;
              const groupOptions =
                group.key === 'tags'
                  ? [...group.options, ...availableTags.map((tag) => ({ value: tag, label: `#${tag}` }))]
                  : group.options;
              return (
                <View key={group.key} style={styles.filterGroup}>
                  <Pressable
                    onPress={() => setExpandedFilter(expanded ? null : group.key)}
                    style={[styles.filterGroupHeader, { backgroundColor: theme.colors.inputBackground }]}
                  >
                    <Icon name={group.icon} size={18} color={theme.colors.textSecondary} />
                    <Text style={[styles.filterGroupLabel, { color: theme.colors.text }]}>{group.label}</Text>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 16 }}>{expanded ? '▾' : '▸'}</Text>
                  </Pressable>
                  {expanded && (
                    <View style={styles.filterSubOptions}>
                      {groupOptions.map((opt) => {
                        const active =
                          group.key === 'time'
                            ? opt.value === 'all'
                              ? filterTimes.size === 0
                              : filterTimes.has(opt.value)
                            : group.key === 'format'
                              ? opt.value === 'all'
                                ? filterFormats.size === 0
                                : filterFormats.has(opt.value)
                              : group.key === 'size'
                                ? opt.value === 'all'
                                  ? filterSizes.size === 0
                                  : filterSizes.has(opt.value)
                                : opt.value === 'all'
                                  ? filterTags.size === 0
                                  : filterTags.has(opt.value);
                        return (
                          <Pressable
                            key={`${group.key}-${opt.value}`}
                            onPress={() => toggleFilter(group.key, opt.value)}
                            style={[styles.filterSubOption, { backgroundColor: active ? theme.colors.primary : theme.colors.inputBackground }]}
                          >
                            <Text style={{ color: active ? '#FFFFFF' : theme.colors.text, fontSize: 14, fontWeight: '600' }}>
                              {opt.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}

            <View style={styles.filterFooter}>
              <Pressable onPress={clearAllFilters} style={[styles.filterFooterBtn, { backgroundColor: theme.colors.inputBackground }]}>
                <Text style={{ color: theme.colors.textSecondary, fontWeight: '600' }}>清除全部</Text>
              </Pressable>
              <Pressable onPress={() => setShowFilter(false)} style={[styles.filterFooterBtn, { backgroundColor: theme.colors.primary }]}>
                <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>完成</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={importing} animationType="fade">
        <View style={styles.importOverlay}>
          <View style={[styles.importCard, { backgroundColor: theme.colors.card }]}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={[styles.importTitle, { color: theme.colors.text }]}>
              {progress.total > 0
                ? '正在导入表情包…'
                : importSource === 'files'
                  ? '正在打开文件…'
                  : importSource === 'clipboard'
                    ? '正在读取剪贴板…'
                    : '正在打开相册…'}
            </Text>
            <Text style={[styles.importSub, { color: theme.colors.textSecondary }]}>
              {progress.total > 0 ? `${progress.done} / ${progress.total}` : '请选择图片'}
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  brandTitle: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 22, fontWeight: '700', lineHeight: 24, letterSpacing: 0, includeFontPadding: false },
  root: { flex: 1 },
  importBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999 },
  overlayBtn: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 999 },
  overlayBtnText: { fontSize: 14, fontWeight: '700' },
  importText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  sortBtn: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999 },
  sortBtnText: { fontSize: 13, fontWeight: '700' },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, maxWidth: 130 },
  filterBtnText: { fontSize: 13, fontWeight: '700' },
  searchRow: { paddingHorizontal: 16, paddingTop: 10 },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 14, height: 42, gap: 8 },
  searchIcon: { fontSize: 15 },
  searchInput: { flex: 1, fontSize: 15 },
  chipScroll: { marginTop: 10, flexGrow: 0 },
  chipContent: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  gridWrap: { flex: 1, marginTop: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  importOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  importCard: { paddingHorizontal: 36, paddingVertical: 28, borderRadius: 20, alignItems: 'center' },
  importTitle: { fontSize: 16, fontWeight: '700', marginTop: 14 },
  importSub: { fontSize: 13, marginTop: 6 },
  filterOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  filterSheet: { width: '100%', maxWidth: 380, borderRadius: 20, padding: 18 },
  filterTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  filterGroup: { marginBottom: 8 },
  filterGroupHeader: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  filterGroupLabel: { flex: 1, marginLeft: 10, fontSize: 15, fontWeight: '700' },
  filterSubOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingLeft: 40, paddingTop: 8 },
  filterSubOption: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  sortOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  sortSheet: { width: '100%', maxWidth: 360, borderRadius: 20, padding: 18 },
  sortTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center', marginBottom: 14 },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sortGroup: { width: 52, fontSize: 14, fontWeight: '700' },
  sortOption: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  filterFooter: { flexDirection: 'row', gap: 10, marginTop: 14 },
  filterFooterBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center' },
});
