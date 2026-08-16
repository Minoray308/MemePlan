import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Category } from '../models/types';
import { useTheme } from '../hooks/useTheme';
import { getChildren } from '../utils/category';
import { CategoryIcon } from './Icon';

interface Props {
  visible: boolean;
  categories: Category[];
  selectedId: string | null;
  onApply: (id: string | null) => void;
  onClose: () => void;
  title?: string;
}

interface TreeRow {
  category: Category;
  depth: number;
  hasChildren: boolean;
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
  const [local, setLocal] = useState<string | null>(selectedId);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (visible) {
      setLocal(selectedId);
      setExpandedIds(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const rows = useMemo<TreeRow[]>(() => {
    const result: TreeRow[] = [];
    const visit = (parentId: string | null, depth: number) => {
      getChildren(categories, parentId).forEach((category) => {
        const children = getChildren(categories, category.id);
        result.push({ category, depth, hasChildren: children.length > 0 });
        if (expandedIds.has(category.id)) {
          visit(category.id, depth + 1);
        }
      });
    };
    visit(null, 0);
    return result;
  }, [categories, expandedIds]);

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
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
          <ScrollView style={styles.list}>
            <Pressable
              onPress={() => selectCategory(null)}
              style={[styles.row, { borderBottomColor: theme.colors.divider }]}
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
                  style={[styles.row, { borderBottomColor: theme.colors.divider, paddingLeft: 16 + depth * 18 }]}
                >
                  <Pressable style={styles.folderMain} onPress={() => (hasChildren ? toggleExpanded(category.id) : selectCategory(category.id))}>
                    <Text style={[styles.folderArrow, { color: theme.colors.textMuted }]}>{hasChildren ? (expanded ? '▾' : '▸') : '·'}</Text>
                    <View style={styles.rowIconWrap}>
                      <CategoryIcon icon={category.icon} size={20} />
                    </View>
                    <Text style={[styles.rowName, { color: theme.colors.text }]} numberOfLines={1}>
                      {category.name}
                    </Text>
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
          </ScrollView>
          <View style={styles.actions}>
            <Pressable onPress={onClose} style={[styles.btn, { backgroundColor: theme.colors.inputBackground }]}>
              <Text style={{ color: theme.colors.textSecondary }}>取消</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                onApply(local);
              }}
              style={[styles.btn, { backgroundColor: theme.colors.primary }]}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>完成</Text>
            </Pressable>
          </View>
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
    paddingBottom: 30,
    maxHeight: '70%',
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
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  actions: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 12, gap: 10 },
  btn: { flex: 1, paddingVertical: 13, borderRadius: 14, alignItems: 'center' },
});
