import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import type { Sticker } from '../models/types';
import { copyStickerToStorage, deleteLocalFile, generateThumbnail } from './fileService';
import { requestMediaLibraryPermission } from './permissionService';
import { isImageMime } from '../constants';
import { deriveNameFromFilename } from '../utils/format';
import { uuid } from '../utils/id';
import { base64ToBytes } from '../utils/base64';
import { detectFileType, mimeForFileType } from '../utils/file';

/**
 * A normalized image source used by the import pipeline. It is intentionally
 * not tied to `expo-image-picker` so album, file-manager and clipboard adapters
 * can all feed the same importer.
 */
export interface PickedImage {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  width?: number;
  height?: number;
  fileSize?: number;
  type?: 'image' | 'video' | 'livePhoto' | 'pairedVideo' | null;
}

export interface ImportResult {
  imported: Sticker[];
  /** number of skipped duplicates (by md5). */
  duplicates: number;
  /** number of failed imports. */
  failed: number;
  error?: string;
}

export interface ImportOptions {
  allowsMultiple?: boolean;
  generateThumbnails?: boolean;
  onProgress?: (pickedCount: number, done: number, total: number) => void;
}

/** Raised when the user denied media-library access required for album import. */
export class MediaPermissionError extends Error {
  readonly code = 'MEDIA_PERMISSION_DENIED';
  constructor() {
    super('Media library permission denied');
    this.name = 'MediaPermissionError';
  }
}

const EMPTY_RESULT: ImportResult = { imported: [], duplicates: 0, failed: 0 };

/** Opens the system photo library and lets the user pick one or a batch of images. */
export async function pickImagesFromLibrary(options: ImportOptions = {}): Promise<PickedImage[]> {
  const perm = await requestMediaLibraryPermission();
  if (!perm.granted) {
    throw new MediaPermissionError();
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: options.allowsMultiple ?? true,
    selectionLimit: options.allowsMultiple === false ? 1 : 0,
    quality: 1,
  });
  if (result.canceled || !result.assets) return [];
  return result.assets.filter((a) => !a.mimeType || isImageMime(a.mimeType));
}

/** Opens the system file manager and lets the user pick image files. */
export async function pickImagesFromFiles(options: { multiple?: boolean } = {}): Promise<PickedImage[]> {
  const multiple = options.multiple ?? true;
  const result = multiple
    ? await File.pickFileAsync({ multipleFiles: true, mimeTypes: ['image/*'] })
    : await File.pickFileAsync({ multipleFiles: false, mimeTypes: ['image/*'] });
  if (result.canceled || !result.result) return [];

  const files = Array.isArray(result.result) ? result.result : [result.result];
  return files.map((file) => ({
    uri: file.uri,
    fileName: file.name,
    mimeType: mimeForFileType(detectFileType(null, file.uri)),
    width: 0,
    height: 0,
    fileSize: typeof file.size === 'number' ? file.size : 0,
    type: 'image',
  }));
}

/** Reads an image from the clipboard and writes it to a local cache file. */
export async function pickImageFromClipboard(): Promise<PickedImage | null> {
  const image = await Clipboard.getImageAsync({ format: 'png' });
  if (!image) return null;

  const match = /^data:([^;]+);base64,(.+)$/.exec(image.data);
  if (!match) return null;

  const mimeType = match[1];
  const bytes = base64ToBytes(match[2]);
  const id = uuid();
  const file = new File(Paths.cache, `clipboard-${id}.png`);
  file.create({ intermediates: true, overwrite: true });
  file.write(bytes);

  return {
    uri: file.uri,
    fileName: `clipboard-${id}.png`,
    mimeType,
    width: image.size?.width,
    height: image.size?.height,
    fileSize: bytes.length,
    type: 'image',
  };
}

/**
 * Copies picked assets into app storage, generating records + thumbnails.
 * Deduplicates against `existing` using file md5 where available.
 */
export async function importAssets(
  assets: PickedImage[],
  existing: Sticker[],
  options: Pick<ImportOptions, 'onProgress' | 'generateThumbnails'> = {},
): Promise<ImportResult> {
  const result: ImportResult = { imported: [], duplicates: 0, failed: 0 };
  const md5Set = new Set(existing.map((s) => s.md5).filter(Boolean) as string[]);

  let done = 0;
  for (const asset of assets) {
    try {
      options.onProgress?.(assets.length, done, assets.length);
      const storage = await copyStickerToStorage(asset.uri, asset.mimeType);
      if (storage.md5 && md5Set.has(storage.md5)) {
        deleteLocalFile(storage.localUri);
        result.duplicates += 1;
        continue;
      }
      const shouldGenerateThumbnail = options.generateThumbnails ?? true;
      const thumbnailUri = shouldGenerateThumbnail
        ? await generateThumbnail(storage.localUri)
        : storage.localUri;
      const now = Date.now();
      const sticker: Sticker = {
        id: uuid(),
        name: deriveNameFromFilename(asset.fileName, '未命名表情'),
        localUri: storage.localUri,
        thumbnailUri,
        fileType: storage.fileType,
        fileSize: storage.fileSize,
        width: asset.width,
        height: asset.height,
        createdAt: now,
        updatedAt: now,
        lastUsedAt: null,
        isFavorite: false,
        categoryId: null,
        tags: [],
        md5: storage.md5,
      };
      md5Set.add(storage.md5);
      result.imported.push(sticker);
    } catch (e) {
      console.warn('[importService] failed to import asset', asset.uri, e);
      result.failed += 1;
    } finally {
      done += 1;
      options.onProgress?.(assets.length, done, assets.length);
    }
  }
  return result;
}

/** Returns platform-specific hint text used by the import sheet. */
export function importSourceOptions(): { key: ImportSourceKey; label: string; available: boolean }[] {
  return [
    { key: 'library', label: '从相册导入', available: true },
    { key: 'files', label: '从文件导入', available: Platform.OS !== 'web' },
    { key: 'clipboard', label: '从剪贴板', available: true },
  ];
}

export type ImportSourceKey = 'library' | 'files' | 'clipboard';




