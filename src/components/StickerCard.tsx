import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Sticker } from '../models/types';
import { useTheme } from '../hooks/useTheme';
import { StickerImage } from './StickerImage';

interface Props {
  sticker: Sticker;
  selectMode: boolean;
  selected: boolean;
  showFormatLabel: boolean;
  animateGifs: boolean;
  onPress: (sticker: Sticker) => void;
  onLongPress: (sticker: Sticker) => void;
}

/** A square grid cell showing a sticker image, favorite badge and selection ring. */
export const StickerCard = memo(function StickerCard({
  sticker,
  selectMode,
  selected,
  showFormatLabel,
  animateGifs,
  onPress,
  onLongPress,
}: Props) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => onPress(sticker)}
      onLongPress={() => onLongPress(sticker)}
      delayLongPress={200}
      style={({ pressed }) => [
        styles.cell,
        { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder },
        pressed && styles.pressed,
      ]}
    >
      <StickerImage uri={sticker.thumbnailUri || sticker.localUri} style={styles.image} autoplay={animateGifs} />

      {sticker.isFavorite && (
        <View style={styles.favBadge}>
          <Text style={styles.favIcon}>⭐</Text>
        </View>
      )}

      {showFormatLabel && (
        <View style={styles.formatBadge}>
          <Text style={styles.formatText}>{sticker.fileType.toUpperCase()}</Text>
        </View>
      )}

      {selectMode && (
        <View
          style={[
            styles.check,
            { borderColor: selected ? theme.colors.primary : 'rgba(255,255,255,0.8)' },
            selected && { backgroundColor: theme.colors.primary },
          ]}
        >
          {selected && <Text style={styles.checkMark}>✓</Text>}
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  cell: {
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.75 },
  image: { width: '100%', height: '100%' },
  favBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 8,
    padding: 1,
  },
  favIcon: { fontSize: 11 },
  formatBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  formatText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
  check: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
