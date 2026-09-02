import React, { useMemo, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Category } from '../models/types';
import { useTheme } from '../hooks/useTheme';
import { getCategoryPath, getPickerRows } from '../utils/category';
import { useStore } from '../state/StoreProvider';
import { useToast } from './ToastProvider';
import { SearchInput } from './SearchInput';
import { NameInputForm } from './NameInputForm';
import { CategoryIcon } from './Icon';

interface Props {
  visible: boolean;
  categories: Category[];
  selectedId: string | null;
  onApply: (id: string | null) => void;
  onClose: () => void;
  title?: string;
}

/** Single-select collapsible folder tree. */
export function CategoryPicker({
  visible,
  categories,
  selectedId,
  onApply,
  onClose,
  title = '选择分类',
}: Props) {
  const theme = useTheme();
  const { createCategory } = useStore();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [local, setLocal] = useState<string | null>(selectedId);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (visible) {
      setLocal(selectedId);
      setExpandedIds(new Set(getCategoryPath(selectedId, categories).map(c => c.id)));
      setQuery('');
      setCreating(false);
      setNewName('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const rows = useMemo(() => getPickerRows(categories, expandedIds, query), [categories, expandedIds, query]);
  const selectedPath = getCategoryPath(local, categories).map(c => c.name).join(' / ');
  const confirmCreate = () => {
    const name = newName.trim();
    if (!name) { toast.error('请输入分类名称'); return; }
    if (categories.some(c => (c.parentId ?? null) === local && c.name === name)) {
      toast.error('此文件夹下已有同名分类'); return;
    }
    const created = createCategory(name, local, 'folder-outline');
    if (!created) return;
    setExpandedIds(prev => new Set([...prev, ...getCategoryPath(local, categories).map(c => c.id)]));
    Keyboard.dismiss();
    setLocal(created.id);
    setQuery('');
    setCreating(false);
    setNewName('');
    toast.success(local ? '子分类已创建' : '分类已创建');
  };

  const cancelCreate = () => {
    Keyboard.dismiss();
    setCreating(false);
    setNewName('');
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectCategory = (id: string | null) => {
    setLocal(id);
    setExpandedIds(prev => new Set([...prev, ...getCategoryPath(id, categories).map(c => c.id)]));
    setCreating(false);
    setNewName('');
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={creating ? cancelCreate : onClose}>
      {creating ? <NameInputForm title={local ? '新建子分类' : '新建分类'} location={selectedPath || '顶层分类'}
        value={newName} onChange={setNewName} onCancel={cancelCreate} onConfirm={confirmCreate} confirmLabel="创建并选中" /> : (
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
          <SearchInput value={query} onChangeText={setQuery} placeholder="搜索分类" />
          <Text style={{ color: theme.colors.primary, marginHorizontal: 20, marginVertical: 8, fontWeight: '700' }}>
            当前选择：{selectedPath || '无分类'}
          </Text>
          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            <Pressable
              onPress={() => selectCategory(null)}
              style={[styles.row, { paddingLeft: 16, borderBottomColor: theme.colors.divider, backgroundColor: local === null ? theme.colors.primarySoft : 'transparent' }]}
            >
              <View style={styles.rowIconWrap}>
                <CategoryIcon icon="close-circle-outline" size={20} color={theme.colors.textMuted} />
              </View>
              <Text style={[styles.rowName, { color: theme.colors.text }]}>无分类</Text>
              <View style={[styles.chip, { borderColor: theme.colors.primary, backgroundColor: local === null ? theme.colors.primary : 'transparent' }]}>
                <Text style={{ color: local === null ? '#FFFFFF' : theme.colors.primary, fontSize: 13, fontWeight: '600' }}>
                  {local === null ? '已选' : '选择'}
                </Text>
              </View>
            </Pressable>

            {rows.map(({ category, depth, hasChildren }) => {
              const active = local === category.id;
              const expanded = expandedIds.has(category.id);
              return (
                <View
                  key={category.id}
                  style={[styles.row, { borderBottomColor: theme.colors.divider, paddingLeft: 16 + (query.trim() ? 0 : Math.min(depth, 6)) * 18, backgroundColor: active ? theme.colors.primarySoft : 'transparent', borderLeftWidth: 4, borderLeftColor: active ? theme.colors.primary : 'transparent' }]}
                >
                  <Pressable onPress={() => toggleExpanded(category.id)} disabled={!hasChildren || !!query.trim()}
                    accessibilityLabel={expanded ? '收起子分类' : '展开子分类'} style={{ paddingVertical: 10, paddingRight: 8 }}>
                    <Text style={[styles.folderArrow, { color: theme.colors.textMuted }]}>{hasChildren && !query.trim() ? (expanded ? '▾' : '▸') : '·'}</Text>
                  </Pressable>
                  <Pressable style={styles.folderMain} onPress={() => selectCategory(category.id)} accessibilityRole="radio" accessibilityState={{ selected: active }}>
                    <View style={styles.rowIconWrap}>
                      <CategoryIcon icon={category.icon} size={20} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.folderName, { color: active ? theme.colors.primary : theme.colors.text, fontWeight: active ? '800' : '400' }]}>{category.name}</Text>
                      {!!query.trim() && <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{getCategoryPath(category.id, categories).map(c => c.name).join(' / ')}</Text>}
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => selectCategory(category.id)}
                    style={[styles.chip, { borderColor: theme.colors.primary, backgroundColor: active ? theme.colors.primary : 'transparent' }]}
                  >
                    <Text style={{ color: active ? '#FFFFFF' : theme.colors.primary, fontSize: 13, fontWeight: '600' }}>
                      {active ? '已选' : '选择'}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
            {rows.length === 0 && <Text style={{ color: theme.colors.textMuted, padding: 20, textAlign: 'center' }}>{query.trim() ? '没有匹配的分类' : '暂无分类'}</Text>}
          <Pressable onPress={() => setCreating(true)} style={{ padding: 14, marginHorizontal: 20 }}>
            <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>{local ? '＋ 在此文件夹下新建子分类' : '＋ 新建顶层分类'}</Text>
          </Pressable>
          </ScrollView>
          <View style={styles.actions}>
            <Pressable onPress={onClose} style={[styles.btn, { backgroundColor: theme.colors.inputBackground }]}>
              <Text style={{ color: theme.colors.textSecondary }}>取消</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (local && !categories.some(c => c.id === local)) { toast.error('所选分类已不存在，请重新选择'); return; }
                onApply(local);
              }}
              style={[styles.btn, { backgroundColor: theme.colors.primary }]}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>完成</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 18,
    paddingBottom: 30,
    maxHeight: '90%',
  },
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  list: { marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  folderMain: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
  folderArrow: { width: 20, fontSize: 14 },
  rowIconWrap: { width: 28, alignItems: 'center', marginRight: 6 },
  rowName: { flex: 1, fontSize: 15 },
  folderName: { fontSize: 15 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  actions: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 12, gap: 10 },
  btn: { flex: 1, paddingVertical: 13, borderRadius: 14, alignItems: 'center' },
});
