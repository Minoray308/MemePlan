import { File, Directory, Paths } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import type { Sticker, StickerFileType } from '../models/types';
import { detectFileType, extensionForFileType } from '../utils/file';
import { uuid } from '../utils/id';

export const STICKERS_DIR_NAME = 'stickers';
export const THUMBS_DIR_NAME = 'thumbs';
export const SHARE_DIR_NAME = 'share';

let dirsReady: Promise<void> | null = null;

/**
 * Ensures the app-managed directories exist. All stored assets live in the
 * documents directory so they survive reboots / cache purges.
 */
export function ensureDirectories(): Promise<void> {
  if (dirsReady) return dirsReady;
  dirsReady = (async () => {
    const base = new Directory(Paths.document);
    const stickers = new Directory(Paths.document, STICKERS_DIR_NAME);
    const thumbs = new Directory(Paths.document, THUMBS_DIR_NAME);
    const share = new Directory(Paths.cache, SHARE_DIR_NAME);
    for (const d of [base, stickers, thumbs, share]) {
      if (!d.exists) d.create({ intermediates: true, idempotent: true });
    }
  })().catch((e) => {
    dirsReady = null;
    throw e;
  });
  return dirsReady;
}

/** Copies a source file (file:// or content://) into the stickers dir, returns metadata. */
export async function copyStickerToStorage(sourceUri: string, mime: string | null | undefined): Promise<{
  localUri: string;
  fileType: StickerFileType;
  fileSize: number;
  md5: string;
}> {
  await ensureDirectories();
  const fileType = detectFileType(mime, sourceUri);
  const id = uuid();
  const dest = new File(Paths.document, STICKERS_DIR_NAME, `${id}${extensionForFileType(fileType)}`);

  const src = new File(sourceUri);
  try {
    src.copySync(dest, { overwrite: true });
  } catch {
    // Fallback for content:// or exotic URIs: read bytes via fetch and write.
    const resp = await fetch(sourceUri);
    const buf = await resp.arrayBuffer();
    dest.create({ overwrite: true, intermediates: true });
    dest.write(new Uint8Array(buf));
  }

  return {
    localUri: dest.uri,
    fileType,
    fileSize: dest.size ?? 0,
    md5: dest.md5 ?? '',
  };
}

/** Deletes a single local file without throwing. */
export function deleteLocalFile(uri: string): void {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch (e) {
    console.warn('[fileService] deleteLocalFile failed', uri, e);
  }
}

/**
 * Generates a small thumbnail from a full-resolution local file.
 * Falls back to the original URI if manipulation is unavailable.
 */
export async function generateThumbnail(localUri: string): Promise<string> {
  try {
    await ensureDirectories();
    const id = uuid();
    const thumb = new File(Paths.document, THUMBS_DIR_NAME, `${id}.jpg`);
    const result = await manipulateAsync(
      localUri,
      [{ resize: { width: 256 } }],
      { compress: 0.75, format: SaveFormat.JPEG },
    );
    if (!result.uri) return localUri;
    const tmp = new File(result.uri);
    if (tmp.exists) tmp.copySync(thumb, { overwrite: true });
    return thumb.uri;
  } catch (e) {
    console.warn('[fileService] thumbnail generation failed, using original', e);
    return localUri;
  }
}

/** Deletes the physical files (original + thumbnail) belonging to stickers. */
export function deleteStickerFiles(stickers: Sticker[]): void {
  try {
    for (const s of stickers) {
      for (const uri of [s.localUri, s.thumbnailUri]) {
        if (!uri) continue;
        deleteLocalFile(uri);
      }
    }
  } catch (e) {
    console.warn('[fileService] deleteStickerFiles error', e);
  }
}

/** Returns a shareable copy in cache for a given sticker file. */
export function prepareShareFile(sticker: Sticker): File {
  ensureDirectories();
  const shareDir = new Directory(Paths.cache, SHARE_DIR_NAME);
  if (!shareDir.exists) shareDir.create({ intermediates: true, idempotent: true });
  const src = new File(sticker.localUri);
  const ext = src.extension || extensionForFileType(sticker.fileType);
  const safeName = (sticker.name || 'sticker').replace(/[\\/:*?"<>|]+/g, '_');
  const dest = new File(shareDir, `${safeName}${ext}`);
  if (!dest.exists) src.copySync(dest, { overwrite: true });
  return dest;
}
