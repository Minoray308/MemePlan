export type StickerFileType = 'png' | 'jpg' | 'jpeg' | 'webp' | 'gif' | 'heic' | 'other';

export interface Sticker {
  id: string;
  /** Display name shown on card / detail. Derived from source filename if empty. */
  name: string;
  /** Full-resolution local file URI in the app documents dir. */
  localUri: string;
  /** Generated thumbnail file URI in the app documents dir. */
  thumbnailUri: string;
  fileType: StickerFileType;
  fileSize: number;
  width?: number;
  height?: number;
  createdAt: number;
  updatedAt: number;
  lastUsedAt: number | null;
  isFavorite: boolean;
  /** Single folder/category id. */
  categoryId: string | null;
  tags: string[];
  /** md5 of original file, used for duplicate detection. */
  md5?: string | null;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  /** Parent folder id, null for top-level folder. */
  parentId?: string | null;
  createdAt: number;
  updatedAt: number;
  /** System categories can not be deleted/renamed. */
  isSystem?: boolean;
}

export type SortOrder =
  | 'recent'
  | 'oldest'
  | 'name'
  | 'format'
  | 'size_desc'
  | 'size_asc'
  | 'tags_desc'
  | 'tags_asc'
  | 'category_asc'
  | 'category_desc';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface Settings {
  /** Number of grid columns (customizable, default 3). */
  gridColumns: number;
  sortOrder: SortOrder;
  /** Reuse thumbnail of source to avoid resizing where possible. */
  generateThumbnails: boolean;
  /** Manual theme override; `system` follows the OS appearance. */
  themeMode: ThemeMode;
  /** Accent color used for navigation bar, buttons and highlights. */
  themeColor: string;
  /** Show the file format label on thumbnail cards. */
  showFormatLabel: boolean;
  /** Animate GIF stickers on the home grid. */
  animateGifs: boolean;
}
