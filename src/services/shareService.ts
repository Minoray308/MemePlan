import * as Sharing from 'expo-sharing';
import { Platform, TurboModuleRegistry } from 'react-native';
import type { Sticker } from '../models/types';
import { prepareShareFile } from './fileService';
import { mimeForFileType } from '../utils/file';

/**
 * Android sharing:
 *  - single image  -> ACTION_SEND          + EXTRA_STREAM (Uri)
 *  - multiple      -> ACTION_SEND_MULTIPLE + EXTRA_STREAM (ArrayList<Uri>)
 * Both go through `Intent.createChooser(...)` so the system Sharesheet is shown.
 * We build the intents with `react-native-share` (native module), which uses the
 * app's FileProvider to produce readable `content://` URIs and adds
 * FLAG_GRANT_READ_URI_PERMISSION (plus a ClipData) for every shared file.
 *
 * `react-native-share` is not bundled in Expo Go. Its module top-level throws
 * when the native module is missing, so we only load it after confirming the
 * native module exists (`TurboModuleRegistry.get('RNShare')`). In Expo Go we
 * fall back to `expo-sharing` for a single file and report "unavailable" for
 * multiple files instead of crashing. iOS keeps using `expo-sharing`
 * (single file per call).
 */

export interface ShareOutcome {
  ok: boolean;
  reason?: 'unavailable' | 'cancelled' | 'error' | 'gif_unsupported';
}

type RNShareApi = typeof import('react-native-share').default;

let rnShareApi: RNShareApi | null | undefined;

/** True when the RNShare native module is registered in the current binary. */
function isRNShareAvailable(): boolean {
  return TurboModuleRegistry.get('RNShare') != null;
}

/** Loads the react-native-share API, or null when the native module is absent (Expo Go). */
function loadRNShare(): RNShareApi | null {
  if (rnShareApi !== undefined) return rnShareApi;
  if (!isRNShareAvailable()) {
    console.warn('[shareService] react-native-share native module unavailable');
    rnShareApi = null;
    return rnShareApi;
  }
  try {
    // Lazy require: only runs in builds where the native module exists, so the
    // module top-level TurboModule lookup cannot fail.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    rnShareApi = require('react-native-share').default as RNShareApi;
  } catch (e) {
    console.warn('[shareService] failed to load react-native-share', e);
    rnShareApi = null;
  }
  return rnShareApi;
}

export async function shareSticker(sticker: Sticker): Promise<ShareOutcome> {
  return shareFile(sticker, '分享表情包');
}

export async function exportSticker(sticker: Sticker): Promise<ShareOutcome> {
  return shareFile(sticker, '导出表情包');
}

/** Shares multiple stickers. Android sends all images at once. */
export async function shareStickers(stickers: Sticker[]): Promise<ShareOutcome> {
  return shareMany(stickers, 'share');
}

/** Exports multiple stickers. Android sends all images at once. */
export async function exportStickers(stickers: Sticker[]): Promise<ShareOutcome> {
  return shareMany(stickers, 'export');
}

/** Maps a thrown value (string or Error) to a ShareOutcome reason. */
function reasonFromError(e: unknown): ShareOutcome['reason'] {
  const msg = e instanceof Error ? e.message : String(e);
  return /not_available|not available|no.*activity/i.test(msg) ? 'unavailable' : 'error';
}

async function shareFile(sticker: Sticker, dialogTitle: string): Promise<ShareOutcome> {
  if (Platform.OS === 'android') {
    const RNShare = loadRNShare();
    if (RNShare) {
      try {
        const file = prepareShareFile(sticker);
        if (!file.exists) {
          console.warn('[shareService] share file missing', file.uri);
          return { ok: false, reason: 'error' };
        }
        // ACTION_SEND with EXTRA_STREAM (content:// Uri), type, chooser + read grant.
        await RNShare.open({
          url: file.uri,
          type: mimeForFileType(sticker.fileType),
          title: dialogTitle,
          failOnCancel: false,
        });
        return { ok: true };
      } catch (e) {
        console.warn('[shareService] android single share failed', e);
        return { ok: false, reason: reasonFromError(e) };
      }
    }
    // Expo Go fallback: expo-sharing already builds a correct single-file
    // ACTION_SEND + createChooser flow with its own FileProvider.
  }

  try {
    const available = await Sharing.isAvailableAsync();
    if (!available) return { ok: false, reason: 'unavailable' };
    const file = prepareShareFile(sticker);
    if (!file.exists) {
      console.warn('[shareService] share file missing', file.uri);
      return { ok: false, reason: 'error' };
    }
    await Sharing.shareAsync(file.uri, {
      mimeType: mimeForFileType(sticker.fileType),
      dialogTitle,
      UTI: utiForSticker(sticker),
    });
    return { ok: true };
  } catch (e) {
    console.warn('[shareService] share failed', e);
    return { ok: false, reason: 'error' };
  }
}

async function shareMany(stickers: Sticker[], mode: 'share' | 'export'): Promise<ShareOutcome> {
  if (stickers.length === 0) return { ok: true };
  if (stickers.length === 1) {
    return mode === 'share' ? shareSticker(stickers[0]) : exportSticker(stickers[0]);
  }

  if (stickers.some((sticker) => sticker.fileType === 'gif')) {
    return { ok: false, reason: 'gif_unsupported' };
  }

  if (Platform.OS === 'android') {
    const RNShare = loadRNShare();
    if (!RNShare) return { ok: false, reason: 'unavailable' };
    try {
      const files = stickers.map((sticker) => prepareShareFile(sticker));
      if (files.some((file) => !file.exists)) {
        console.warn('[shareService] one or more share files are missing');
        return { ok: false, reason: 'error' };
      }
      // ACTION_SEND_MULTIPLE with EXTRA_STREAM = ArrayList<content:// Uri>,
      // type image/*, chooser + read grants for every URI.
      await RNShare.open({
        urls: files.map((file) => file.uri),
        type: 'image/*',
        title: mode === 'share' ? '分享表情包' : '导出表情包',
        failOnCancel: false,
      });
      return { ok: true };
    } catch (e) {
      console.warn('[shareService] android multi share failed', e);
      return { ok: false, reason: reasonFromError(e) };
    }
  }

  // iOS (and other platforms): expo-sharing supports a single file per call.
  for (const sticker of stickers) {
    const outcome = mode === 'share' ? await shareSticker(sticker) : await exportSticker(sticker);
    if (!outcome.ok) return outcome;
  }
  return { ok: true };
}

export function utiForSticker(sticker: Sticker): string | undefined {
  switch (sticker.fileType) {
    case 'png': return 'public.png';
    case 'jpg': case 'jpeg': return 'public.jpeg';
    case 'gif': return 'com.compuserve.gif';
    default: return undefined;
  }
}
