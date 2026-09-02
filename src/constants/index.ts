/**
 * Virtual categories are NOT persisted as real categories and are constructed
 * on the fly for filter chips.
 */
export const VIRTUAL_CATEGORY_IDS = {
  all: 'cat__all',
  recents: 'cat__recents',
  favorites: 'cat__favorites',
} as const;

/** Persisted real categories. Virtual categories appended on read. */
export const STORAGE_KEYS = {
  stickers: 'sticker:data:v1',
  categories: 'sticker:categories:v1',
  settings: 'sticker:settings:v1',
  tags: 'sticker:tags:v1',
} as const;

export function isImageMime(mime: string | null | undefined): boolean {
  if (!mime) return false;
  const lower = mime.toLowerCase();
  return lower.startsWith('image/') && !lower.includes('video');
}
