import type { StickerFileType } from '../models/types';

/** Maps a MIME type or file extension to our normalized sticker file type. */
export function detectFileType(mime: string | null | undefined, uri: string): StickerFileType {
  const lower = (mime || '').toLowerCase();
  if (lower.includes('png')) return 'png';
  if (lower.includes('webp')) return 'webp';
  if (lower.includes('gif')) return 'gif';
  if (lower.includes('heic') || lower.includes('heif')) return 'heic';
  if (lower.includes('jpeg') || lower.includes('jpg')) return 'jpg';
  const ext = (uri.split('?')[0].split('.').pop() || '').toLowerCase();
  if (ext === 'png') return 'png';
  if (ext === 'webp') return 'webp';
  if (ext === 'gif') return 'gif';
  if (ext === 'jpg' || ext === 'jpeg') return 'jpg';
  if (ext === 'heic' || ext === 'heif') return 'heic';
  return 'other';
}

/** Extension (with dot) for a normalized file type. */
export function extensionForFileType(type: StickerFileType): string {
  switch (type) {
    case 'png': return '.png';
    case 'jpg': return '.jpg';
    case 'webp': return '.webp';
    case 'gif': return '.gif';
    case 'heic': return '.heic';
    default: return '.img';
  }
}

/** MIME type for a normalized file type. */
export function mimeForFileType(type: StickerFileType): string {
  switch (type) {
    case 'png': return 'image/png';
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    case 'heic': return 'image/heic';
    default: return 'application/octet-stream';
  }
}
