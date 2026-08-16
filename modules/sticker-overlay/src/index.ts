import { requireOptionalNativeModule, type NativeModule } from 'expo-modules-core';

/** Event payloads emitted by the native StickerOverlay module. */
export type StickerOverlayEvents = {
  /** A sticker in the floating window was tapped (path = app-local file). */
  onStickerTapped: (payload: { path: string }) => void;
  /** The tapped sticker was copied into the system gallery. */
  onSaved: (payload: { uri: string }) => void;
  /** The user confirmed the image was sent; the temp copy was deleted. */
  onSent: (payload: { uri: string }) => void;
  /** After a temp copy was cleaned up. */
  onCleaned: () => void;
  /** The floating window was closed. */
  onClosed: () => void;
  /** Something failed while saving the temp copy. */
  onError: (payload: { message: string }) => void;
};

/** One sticker passed to the floating window, with search/filter metadata. */
export interface StickerOverlayItem {
  /** App-local file path of the sticker (file://... or absolute path). */
  path: string;
  name: string;
  fileType: string;
  tags: string[];
  categoryName: string | null;
  isFavorite: boolean;
  lastUsedAt: number | null;
  /** Times this sticker was used before (drives the 高频 filter). */
  useCount: number;
  createdAt: number;
}

/** Native methods implemented in modules/sticker-overlay/android. */
declare class NativeStickerOverlay extends NativeModule<StickerOverlayEvents> {
  isAvailable(): boolean;
  canDrawOverlays(): boolean;
  openOverlaySettings(): Promise<void>;
  show(itemsJson: string, filtersJson: string): Promise<void>;
  hide(): Promise<void>;
  collapse(): Promise<void>;
  expand(): Promise<void>;
  cleanupOrphanedTemps(maxAgeMs: number): Promise<void>;
}

const native = requireOptionalNativeModule<NativeStickerOverlay>('StickerOverlay');

export type StickerOverlayEventName = keyof StickerOverlayEvents;
export type StickerOverlaySubscription = { remove(): void };

/**
 * Wraps the native floating-window module with a safe fallback: on clients
 * where the native module is missing (Expo Go, iOS, web) every call degrades
 * to a no-op / false instead of throwing, so the rest of the app keeps working.
 */
export const StickerOverlay = {
  isAvailable(): boolean {
    return native != null;
  },

  canDrawOverlays(): boolean {
    return native ? native.canDrawOverlays() : false;
  },

  openOverlaySettings(): Promise<void> {
    return native ? native.openOverlaySettings() : Promise.resolve();
  },

  async show(items: StickerOverlayItem[], filters: string[] = []): Promise<boolean> {
    if (!native) return false;
    try {
      await native.show(JSON.stringify(items), JSON.stringify(filters));
      return true;
    } catch (e) {
      console.warn('[StickerOverlay] show failed', e);
      return false;
    }
  },

  hide(): Promise<void> {
    return native ? native.hide() : Promise.resolve();
  },

  collapse(): Promise<void> {
    return native ? native.collapse() : Promise.resolve();
  },

  expand(): Promise<void> {
    return native ? native.expand() : Promise.resolve();
  },

  cleanupOrphanedTemps(maxAgeMs = 24 * 60 * 60 * 1000): Promise<void> {
    return native ? native.cleanupOrphanedTemps(maxAgeMs) : Promise.resolve();
  },

  addListener<E extends StickerOverlayEventName>(
    event: E,
    listener: StickerOverlayEvents[E],
  ): StickerOverlaySubscription {
    if (!native) return { remove() {} };
    return native.addListener(event, listener);
  },
};

export default StickerOverlay;
