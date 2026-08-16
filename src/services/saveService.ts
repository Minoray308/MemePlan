import { requireOptionalNativeModule } from 'expo-modules-core';
import { Directory, File, Paths } from 'expo-file-system';
import type { Sticker } from '../models/types';
import { SHARE_DIR_NAME } from './fileService';
import { extensionForFileType } from '../utils/file';
import { uuid } from '../utils/id';

/**
 * Saves stickers to the system photo library ("相册").
 *
 * Target: latest Android only (minSdk 30 / Android 11+).
 * On Android 11+ saving via MediaStore needs no permission, so we request
 * write-only access purely for iOS.
 *
 * We use the legacy `expo-media-library/legacy` API, which talks to the
 * `ExpoMediaLibrary` native module that has shipped in Expo Go for many SDK
 * versions (the newer `ExpoMediaLibraryNext` module is not available in every
 * client binary). The module is loaded lazily and only after confirming the
 * native module exists, so an older client binary can never crash the app at
 * startup because of this import.
 */

export interface SaveOutcome {
  ok: boolean;
  reason?: 'unavailable' | 'denied' | 'error';
  saved: number;
  total: number;
}

type LegacyMediaLibraryModule = typeof import('expo-media-library/legacy');

let mediaLibraryApi: LegacyMediaLibraryModule | null | undefined;

/** True when the legacy expo-media-library native module is registered. */
function isMediaLibraryAvailable(): boolean {
  return requireOptionalNativeModule('ExpoMediaLibrary') != null;
}

/** Loads expo-media-library/legacy, or null when the native module is absent. */
function loadMediaLibrary(): LegacyMediaLibraryModule | null {
  if (mediaLibraryApi !== undefined) return mediaLibraryApi;
  if (!isMediaLibraryAvailable()) {
    console.warn('[saveService] expo-media-library native module unavailable');
    mediaLibraryApi = null;
    return mediaLibraryApi;
  }
  try {
    // Lazy require: only runs when the native module exists, so the module
    // top-level native lookup cannot fail.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mediaLibraryApi = require('expo-media-library/legacy') as LegacyMediaLibraryModule;
  } catch (e) {
    console.warn('[saveService] failed to load expo-media-library', e);
    mediaLibraryApi = null;
  }
  return mediaLibraryApi;
}

/** Copies a sticker to a uniquely named cache file ready to be imported. */
function prepareSaveFile(sticker: Sticker): File {
  const shareDir = new Directory(Paths.cache, SHARE_DIR_NAME);
  if (!shareDir.exists) shareDir.create({ intermediates: true, idempotent: true });
  const src = new File(sticker.localUri);
  const ext = src.extension || extensionForFileType(sticker.fileType);
  const dest = new File(shareDir, `${uuid()}${ext}`);
  src.copySync(dest, { overwrite: true });
  return dest;
}

export async function saveStickersToGallery(stickers: Sticker[]): Promise<SaveOutcome> {
  const total = stickers.length;
  if (total === 0) return { ok: true, saved: 0, total };

  const MediaLibrary = loadMediaLibrary();
  if (!MediaLibrary) return { ok: false, reason: 'unavailable', saved: 0, total };

  try {
    const permission = await MediaLibrary.requestPermissionsAsync(true, []);
    if (!permission.granted) {
      return { ok: false, reason: 'denied', saved: 0, total };
    }
  } catch (e) {
    console.warn('[saveService] permission request failed', e);
    return { ok: false, reason: 'error', saved: 0, total };
  }

  let saved = 0;
  for (const sticker of stickers) {
    try {
      const file = prepareSaveFile(sticker);
      await MediaLibrary.saveToLibraryAsync(file.uri);
      saved += 1;
    } catch (e) {
      console.warn('[saveService] failed to save sticker to gallery', sticker.name, e);
    }
  }

  if (saved === 0) return { ok: false, reason: 'error', saved, total };
  return { ok: true, saved, total };
}
