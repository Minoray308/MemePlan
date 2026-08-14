import { useCallback, useMemo, useState } from 'react';
import type { Sticker } from '../models/types';

/**
 * Manages multi-select mode for sticker grids.
 * Long-press enters selection; tapping in select mode toggles an item.
 */
export function useSelection() {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const enterSelection = useCallback((id?: string) => {
    setSelectMode(true);
    if (id) setSelectedIds(new Set([id]));
  }, []);

  const exitSelection = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) setSelectMode(false);
      return next;
    });
  }, []);

  const toggleForDrag = useCallback((id: string) => {
    setSelectMode(true);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const select = useCallback((id: string) => {
    setSelectMode(true);
    setSelectedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const setAll = useCallback((items: Sticker[]) => {
    if (!items.length) return;
    setSelectMode(true);
    setSelectedIds(new Set(items.map((s) => s.id)));
  }, []);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  const onItemPress = useCallback(
    (item: Sticker, open: (s: Sticker) => void) => {
      if (selectMode) toggle(item.id);
      else open(item);
    },
    [selectMode, toggle],
  );

  return {
    selectMode,
    selectedIds: selected,
    selectedCount: selected.size,
    enterSelection,
    exitSelection,
    toggle,
    toggleForDrag,
    select,
    clear,
    setAll,
    onItemPress,
  };
}
