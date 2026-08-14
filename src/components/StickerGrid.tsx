import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { FlatList, PanResponder, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { Sticker } from '../models/types';
import { useTheme } from '../hooks/useTheme';
import { StickerCard } from './StickerCard';

interface Props {
  stickers: Sticker[];
  columns: number;
  selectMode: boolean;
  selectedIds: Set<string>;
  showFormatLabel: boolean;
  animateGifs: boolean;
  onOpenSticker: (sticker: Sticker) => void;
  onLongPress: (sticker: Sticker) => void;
  onDragSelect?: (id: string) => void;
  ListEmptyComponent?: React.ComponentType | React.ReactElement;
  ListHeaderComponent?: React.ComponentType | React.ReactElement;
}

interface ItemRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function keyExtractor(item: Sticker) {
  return item.id;
}

/** Responsive sticker grid with tap selection and drag-to-select support. */
export function StickerGrid(props: Props) {
  const { stickers, columns, selectMode, selectedIds, showFormatLabel, animateGifs, onOpenSticker, onLongPress, onDragSelect } = props;
  const theme = useTheme();
  const { width } = useWindowDimensions();

  const safeColumns = Math.max(1, Math.min(64, Math.round(columns) || 1));
  const itemRefs = useRef<Record<string, View | null>>({});
  const itemLayouts = useRef<Record<string, ItemRect>>({});
  const dragAdded = useRef<Set<string>>(new Set());

  const itemSize = useMemo(() => {
    const horizontalPadding = 16 * 2;
    const gap = 10;
    const usable = width - horizontalPadding;
    return (usable - gap * (safeColumns - 1)) / safeColumns;
  }, [width, safeColumns]);

  const measureVisibleItems = useCallback(() => {
    Object.entries(itemRefs.current).forEach(([id, ref]) => {
      if (!ref) return;
      ref.measureInWindow((x, y, w, h) => {
        itemLayouts.current[id] = { x, y, width: w, height: h };
      });
    });
  }, []);

  useEffect(() => {
    if (!selectMode) {
      dragAdded.current.clear();
      return;
    }
    const timer = setTimeout(measureVisibleItems, 80);
    return () => clearTimeout(timer);
  }, [selectMode, measureVisibleItems]);

  useEffect(() => {
    if (!selectMode) return;
    const timer = setTimeout(measureVisibleItems, 120);
    return () => clearTimeout(timer);
  }, [stickers, selectMode, measureVisibleItems]);

  const handlePoint = useCallback(
    (pageX: number, pageY: number) => {
      Object.entries(itemLayouts.current).forEach(([id, rect]) => {
        if (dragAdded.current.has(id)) return;
        if (
          pageX >= rect.x &&
          pageX <= rect.x + rect.width &&
          pageY >= rect.y &&
          pageY <= rect.y + rect.height
        ) {
          dragAdded.current.add(id);
          onDragSelect?.(id);
        }
      });
    },
    [onDragSelect],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) =>
          selectMode && (Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4),
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          selectMode && (Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4),
        onPanResponderGrant: (evt) => {
          dragAdded.current.clear();
          measureVisibleItems();
          handlePoint(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
        },
        onPanResponderMove: (evt) => {
          handlePoint(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
        },
        onPanResponderRelease: () => {
          dragAdded.current.clear();
        },
        onPanResponderTerminate: () => {
          dragAdded.current.clear();
        },
      }),
    [selectMode, measureVisibleItems, handlePoint],
  );

  const renderItem = React.useCallback(
    ({ item }: { item: Sticker }) => (
      <View
        ref={(ref) => {
          if (ref) itemRefs.current[item.id] = ref;
          else delete itemRefs.current[item.id];
        }}
        style={{ width: itemSize, marginBottom: 10 }}
      >
        <StickerCard
          sticker={item}
          selectMode={selectMode}
          selected={selectedIds.has(item.id)}
          showFormatLabel={showFormatLabel}
          animateGifs={animateGifs}
          onPress={onOpenSticker}
          onLongPress={onLongPress}
        />
      </View>
    ),
    [itemSize, selectMode, selectedIds, showFormatLabel, animateGifs, onOpenSticker, onLongPress],
  );

  return (
    <View style={styles.wrap} {...panResponder.panHandlers}>
      <FlatList
        data={stickers}
        key={safeColumns}
        numColumns={safeColumns}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        columnWrapperStyle={safeColumns > 1 ? styles.row : undefined}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!selectMode}
        contentContainerStyle={[styles.content, safeColumns === 1 && styles.singleContent]}
        ListEmptyComponent={props.ListEmptyComponent}
        ListHeaderComponent={props.ListHeaderComponent}
        removeClippedSubviews
        initialNumToRender={24}
        maxToRenderPerBatch={24}
        windowSize={7}
        style={{ backgroundColor: theme.colors.background }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  row: {
    gap: 10,
    paddingHorizontal: 16,
  },
  content: {
    paddingBottom: 32,
  },
  singleContent: {
    paddingHorizontal: 16,
  },
});
