import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';
import type { Sticker } from '../models/types';
import { prepareShareFile } from './fileService';
import { mimeForFileType } from '../utils/file';

/**
 * Android uses native ACTION_SEND / ACTION_SEND_MULTIPLE so one image and
 * multiple images go through the same system share flow. iOS falls back to
 * `expo-sharing` (single file).
 */

export interface ShareOutcome {
  ok: boolean;
  reason?: 'unavailable' | 'cancelled' | 'error' | 'gif_unsupported';
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

async function shareFile(sticker: Sticker, dialogTitle: string): Promise<ShareOutcome> {
  if (Platform.OS === 'android') {
    try {
      const file = prepareShareFile(sticker);
      await IntentLauncher.startActivityAsync('android.intent.action.SEND', {
        type: mimeForFileType(sticker.fileType),
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        extra: {
          'android.intent.extra.STREAM': file.contentUri,
        },
      });
      return { ok: true };
    } catch (e) {
      console.warn('[shareService] android single share failed', e);
      return { ok: false, reason: 'error' };
    }
  }

  try {
    const available = await Sharing.isAvailableAsync();
    if (!available) return { ok: false, reason: 'unavailable' };
    const file = prepareShareFile(sticker);
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
    try {
      const contentUris = stickers.map((sticker) => prepareShareFile(sticker).contentUri);
      await IntentLauncher.startActivityAsync('android.intent.action.SEND_MULTIPLE', {
        type: 'image/*',
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        extra: {
          'android.intent.extra.STREAM': contentUris,
        },
      });
      return { ok: true };
    } catch (e) {
      console.warn('[shareService] android multi share failed', e);
      return { ok: false, reason: 'error' };
    }
  }

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
