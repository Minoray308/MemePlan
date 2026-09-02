import { Platform } from 'react-native';
import { StickerOverlay } from '../../modules/sticker-overlay/src';
import type {
  StickerOverlayEventName,
  StickerOverlayEvents,
  StickerOverlayItem,
  StickerOverlaySubscription,
} from '../../modules/sticker-overlay/src';
import type { Sticker } from '../models/types';

/** The floating window shows at most this many stickers (most recent first). */
const MAX_OVERLAY_STICKERS = 200;

/** Orphaned temp gallery images older than this are deleted on app start. */
const ORPHAN_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Maps stickers (plus category names) to the descriptor list the native
 * floating window uses for search / filtering / thumbnails.
 */
function overlayItemsFor(
  stickers: Sticker[],
  categoryNames?: Record<string, string>,
): StickerOverlayItem[] {
  return stickers
    .slice()
    .sort((a, b) => (b.lastUsedAt ?? b.createdAt) - (a.lastUsedAt ?? a.createdAt))
    .slice(0, MAX_OVERLAY_STICKERS)
    .filter((s) => s.localUri.length > 0)
    .map((s) => ({
      path: s.localUri,
      name: s.name,
      fileType: s.fileType,
      tags: s.tags,
      categoryName: s.categoryId ? categoryNames?.[s.categoryId] ?? null : null,
      isFavorite: s.isFavorite,
      lastUsedAt: s.lastUsedAt ?? null,
      useCount: s.useCount || 0,
      createdAt: s.createdAt,
    }));
}

/**
 * High-level API for the "quick send via floating window" feature.
 * Everything degrades gracefully when the native module is unavailable
 * (Expo Go / iOS), so importing this service never breaks the app.
 */
export const StickerOverlayService = {
  /** True only on Android builds that include the native module. */
  isAvailable(): boolean {
    return Platform.OS === 'android' && StickerOverlay.isAvailable();
  },

  async canDrawOverlays(): Promise<boolean> {
    return StickerOverlay.canDrawOverlays();
  },

  openOverlaySettings(): Promise<void> {
    return StickerOverlay.openOverlaySettings();
  },

  /**
   * Shows the floating window with the given stickers (recent first, capped).
   * @param categoryNames maps category id -> display name so the window can
   * search by category too.
   */
  async showOverlay(
    stickers: Sticker[],
    categoryNames?: Record<string, string>,
    filters?: string[],
    primaryColor?: string,
  ): Promise<boolean> {
    if (!StickerOverlayService.isAvailable()) return false;
    const items = overlayItemsFor(stickers, categoryNames);
    return StickerOverlay.show(items, filters, primaryColor);
  },

  setThemeColor(color: string): Promise<void> {
    return StickerOverlay.setThemeColor(color);
  },

  hideOverlay(): Promise<void> {
    return StickerOverlay.hide();
  },

  collapseOverlay(): Promise<void> {
    return StickerOverlay.collapse();
  },

  expandOverlay(): Promise<void> {
    return StickerOverlay.expand();
  },

  /** Deletes leftover temp gallery copies from previous sessions (older than 24h). */
  cleanupOrphanedTemps(): Promise<void> {
    return StickerOverlay.cleanupOrphanedTemps(ORPHAN_TTL_MS);
  },

  addListener<E extends StickerOverlayEventName>(
    event: E,
    listener: StickerOverlayEvents[E],
  ): StickerOverlaySubscription {
    return StickerOverlay.addListener(event, listener);
  },
};

export type {
  StickerOverlayEventName,
  StickerOverlayEvents,
  StickerOverlaySubscription,
};
