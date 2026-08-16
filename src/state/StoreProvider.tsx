import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Category, Settings, Sticker } from '../models/types';
import {
  DEFAULT_SETTINGS,
  loadCategories,
  loadSettings,
  loadStickers,
  loadTags,
  saveCategories,
  saveSettings,
  saveStickers,
  saveTags,
} from '../database/repository';
import {
  importAssets,
  pickImageFromClipboard,
  pickImagesFromFiles,
  pickImagesFromLibrary,
  ImportResult,
  PickedImage,
} from '../services/importService';
import { deleteStickerFiles } from '../services/fileService';
import { overlayTagKey } from '../constants/overlay';
import { uuid } from '../utils/id';

export interface VirtualCategory {
  id: string;
  name: string;
  icon: string;
  isVirtual: true;
}

export type ViewCategory = Category | VirtualCategory;

export type ImportProgressCallback = (picked: number, done: number, total: number) => void;

export interface ImportCallOptions {
  multiple?: boolean;
  onProgress?: ImportProgressCallback;
}

export interface StoreValue {
  stickers: Sticker[];
  categories: Category[];
  settings: Settings;
  loaded: boolean;
  favorites: Sticker[];
  allTags: string[];
  viewCategories: ViewCategory[];
  importFromLibrary: (opts?: ImportCallOptions) => Promise<ImportResult>;
  importFromFiles: (opts?: ImportCallOptions) => Promise<ImportResult>;
  importFromClipboard: (opts?: ImportCallOptions) => Promise<ImportResult>;
  toggleFavorite: (id: string) => void;
  touchSticker: (id: string) => void;
  renameSticker: (id: string, name: string) => void;
  setStickerCategory: (id: string, categoryId: string | null) => void;
  moveStickersToCategory: (ids: string[], categoryId: string | null) => void;
  setStickerTags: (id: string, tags: string[]) => void;
  addTagsToStickers: (ids: string[], tags: string[]) => void;
  removeTagsFromStickers: (ids: string[], tags: string[]) => void;
  createTag: (name: string) => string | null;
  renameTag: (oldTag: string, newTag: string) => void;
  deleteTag: (tag: string) => void;
  deleteStickers: (ids: string[]) => void;
  createCategory: (name: string, parentId?: string | null, icon?: string) => Category | null;
  renameCategory: (id: string, name: string) => void;
  deleteCategory: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

const EMPTY_RESULT: ImportResult = { imported: [], duplicates: 0, failed: 0 };

function normalizeSticker(raw: Partial<Sticker> & { categoryIds?: string[] }): Sticker {
  const { categoryIds, categoryId, ...rest } = raw;
  return {
    ...rest,
    name: typeof rest.name === 'string' ? rest.name : '未命名表情',
    localUri: rest.localUri || '',
    thumbnailUri: rest.thumbnailUri || rest.localUri || '',
    fileType: rest.fileType || 'other',
    fileSize: rest.fileSize || 0,
    createdAt: rest.createdAt || Date.now(),
    updatedAt: rest.updatedAt || Date.now(),
    lastUsedAt: rest.lastUsedAt ?? null,
    isFavorite: !!rest.isFavorite,
    categoryId: categoryId ?? (Array.isArray(categoryIds) ? categoryIds[0] ?? null : null),
    tags: Array.isArray(rest.tags) ? rest.tags : [],
    md5: rest.md5 ?? null,
  } as Sticker;
}

function normalizeCategory(raw: Partial<Category>): Category {
  return {
    id: raw.id || uuid(),
    name: raw.name || '未命名分类',
    icon: raw.icon || 'folder-outline',
    parentId: raw.parentId ?? null,
    createdAt: raw.createdAt || Date.now(),
    updatedAt: raw.updatedAt || Date.now(),
    isSystem: !!raw.isSystem,
  };
}

function collectCategoryAndDescendants(categoryId: string, categories: Category[]): string[] {
  const result: string[] = [];
  const stack = [categoryId];
  while (stack.length) {
    const id = stack.pop();
    if (!id || result.includes(id)) continue;
    result.push(id);
    categories.filter((c) => c.parentId === id).forEach((child) => stack.push(child.id));
  }
  return result;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  const stickersRef = useRef<Sticker[]>([]);
  stickersRef.current = stickers;

  const settingsRef = useRef<Settings>(settings);
  settingsRef.current = settings;

  useEffect(() => {
    (async () => {
      try {
        const [rawStickers, rawCategories, st, rawTags] = await Promise.all([
          loadStickers(),
          loadCategories(),
          loadSettings(),
          loadTags(),
        ]);

        const normalizedCategories = rawCategories.map(normalizeCategory);
        const systemIds = new Set(
          normalizedCategories.filter((cat) => cat.isSystem).map((cat) => cat.id),
        );
        const nextCategories = normalizedCategories.filter((cat) => !cat.isSystem);
        const normalizedStickers = rawStickers.map(normalizeSticker);

        let nextStickers = normalizedStickers;
        if (systemIds.size > 0) {
          nextStickers = normalizedStickers.map((sticker) =>
            sticker.categoryId && systemIds.has(sticker.categoryId)
              ? { ...sticker, categoryId: null }
              : sticker,
          );
          saveStickers(nextStickers).catch((e) => console.warn('[store] migrate stickers failed', e));
        }

        if (nextCategories.length !== normalizedCategories.length) {
          saveCategories(nextCategories).catch((e) => console.warn('[store] migrate categories failed', e));
        }

        setStickers(nextStickers);
        setCategories(nextCategories);
        setSettings(st);
        setAllTags(Array.isArray(rawTags) ? rawTags : []);
      } catch (e) {
        console.warn('[store] initial load failed', e);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const setStickersPersist = useCallback((updater: (prev: Sticker[]) => Sticker[]) => {
    setStickers((prev) => {
      const next = updater(prev);
      saveStickers(next).catch((e) => console.warn('[store] save stickers failed', e));
      return next;
    });
  }, []);

  const setCategoriesPersist = useCallback((updater: (prev: Category[]) => Category[]) => {
    setCategories((prev) => {
      const next = updater(prev);
      saveCategories(next).catch((e) => console.warn('[store] save categories failed', e));
      return next;
    });
  }, []);

  const setTagsPersist = useCallback((updater: (prev: string[]) => string[]) => {
    setAllTags((prev) => {
      const next = updater(prev);
      saveTags(next).catch((e) => console.warn('[store] save tags failed', e));
      return next;
    });
  }, []);

  const commitImport = useCallback(
    async (assets: PickedImage[], onProgress?: ImportProgressCallback) => {
      const result = await importAssets(assets, stickersRef.current, {
        onProgress,
        generateThumbnails: settingsRef.current.generateThumbnails,
      });
      if (result.imported.length) {
        setStickersPersist((prev) => [...result.imported, ...prev]);
      }
      return result;
    },
    [setStickersPersist],
  );

  const importFromLibrary = useCallback(
    async (opts?: ImportCallOptions) => {
      const assets = await pickImagesFromLibrary({ allowsMultiple: opts?.multiple ?? true });
      if (!assets.length) return EMPTY_RESULT;
      return commitImport(assets, opts?.onProgress);
    },
    [commitImport],
  );

  const importFromFiles = useCallback(
    async (opts?: ImportCallOptions) => {
      const assets = await pickImagesFromFiles({ multiple: opts?.multiple ?? true });
      if (!assets.length) return EMPTY_RESULT;
      return commitImport(assets, opts?.onProgress);
    },
    [commitImport],
  );

  const importFromClipboard = useCallback(
    async (opts?: ImportCallOptions) => {
      const asset = await pickImageFromClipboard();
      if (!asset) return EMPTY_RESULT;
      return commitImport([asset], opts?.onProgress);
    },
    [commitImport],
  );

  const toggleFavorite = useCallback(
    (id: string) => {
      setStickersPersist((prev) =>
        prev.map((s) => (s.id === id ? { ...s, isFavorite: !s.isFavorite, updatedAt: Date.now() } : s)),
      );
    },
    [setStickersPersist],
  );

  const touchSticker = useCallback(
    (id: string) => {
      setStickersPersist((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, lastUsedAt: Date.now(), useCount: (s.useCount || 0) + 1 } : s,
        ),
      );
    },
    [setStickersPersist],
  );

  const renameSticker = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setStickersPersist((prev) =>
        prev.map((s) => (s.id === id ? { ...s, name: trimmed, updatedAt: Date.now() } : s)),
      );
    },
    [setStickersPersist],
  );

  const setStickerCategory = useCallback(
    (id: string, categoryId: string | null) => {
      setStickersPersist((prev) =>
        prev.map((s) => (s.id === id ? { ...s, categoryId, updatedAt: Date.now() } : s)),
      );
    },
    [setStickersPersist],
  );

  const moveStickersToCategory = useCallback(
    (ids: string[], categoryId: string | null) => {
      setStickersPersist((prev) =>
        prev.map((s) =>
          ids.includes(s.id) ? { ...s, categoryId, updatedAt: Date.now() } : s,
        ),
      );
    },
    [setStickersPersist],
  );

  // Keep the floating window filter list in sync with the tags that exist.
  const ensureOverlayFilter = useCallback((key: string) => {
    setSettings((prev) => {
      if (prev.overlayFilters.includes(key)) return prev;
      const next = { ...prev, overlayFilters: [...prev.overlayFilters, key] };
      saveSettings(next).catch((e) => console.warn('[store] save settings failed', e));
      return next;
    });
  }, []);

  const removeOverlayFilter = useCallback((key: string) => {
    setSettings((prev) => {
      if (!prev.overlayFilters.includes(key)) return prev;
      const next = { ...prev, overlayFilters: prev.overlayFilters.filter((k) => k !== key) };
      saveSettings(next).catch((e) => console.warn('[store] save settings failed', e));
      return next;
    });
  }, []);

  const setStickerTags = useCallback(
    (id: string, tags: string[]) => {
      setStickersPersist((prev) =>
        prev.map((s) => (s.id === id ? { ...s, tags, updatedAt: Date.now() } : s)),
      );
      tags.forEach((tag) => ensureOverlayFilter(overlayTagKey(tag)));
    },
    [setStickersPersist, ensureOverlayFilter],
  );

  const addTagsToStickers = useCallback(
    (ids: string[], tags: string[]) => {
      const clean = Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean)));
      if (!clean.length || !ids.length) return;
      const idSet = new Set(ids);
      setStickersPersist((prev) =>
        prev.map((s) =>
          idSet.has(s.id)
            ? { ...s, tags: Array.from(new Set([...s.tags, ...clean])), updatedAt: Date.now() }
            : s,
        ),
      );
      setTagsPersist((prev) => Array.from(new Set([...prev, ...clean])));
      clean.forEach((tag) => ensureOverlayFilter(overlayTagKey(tag)));
    },
    [setStickersPersist, setTagsPersist, ensureOverlayFilter],
  );

  const removeTagsFromStickers = useCallback(
    (ids: string[], tags: string[]) => {
      const clean = new Set(tags.map((t) => t.trim()).filter(Boolean));
      if (!clean.size || !ids.length) return;
      const idSet = new Set(ids);
      setStickersPersist((prev) =>
        prev.map((s) =>
          idSet.has(s.id)
            ? { ...s, tags: s.tags.filter((t) => !clean.has(t)), updatedAt: Date.now() }
            : s,
        ),
      );
    },
    [setStickersPersist],
  );

  const createTag = useCallback(
    (name: string): string | null => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const exists =
        allTags.includes(trimmed) || stickersRef.current.some((s) => s.tags.includes(trimmed));
      if (exists) return trimmed;
      setTagsPersist((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
      ensureOverlayFilter(overlayTagKey(trimmed));
      return trimmed;
    },
    [allTags, setTagsPersist, ensureOverlayFilter],
  );

  const renameTag = useCallback(
    (oldTag: string, newTag: string) => {
      const trimmed = newTag.trim();
      if (!trimmed || trimmed === oldTag) return;
      setStickersPersist((prev) =>
        prev.map((s) =>
          s.tags.includes(oldTag)
            ? { ...s, tags: s.tags.map((t) => (t === oldTag ? trimmed : t)), updatedAt: Date.now() }
            : s,
        ),
      );
      setTagsPersist((prev) => prev.map((tag) => (tag === oldTag ? trimmed : tag)));
      removeOverlayFilter(overlayTagKey(oldTag));
      ensureOverlayFilter(overlayTagKey(trimmed));
    },
    [setStickersPersist, setTagsPersist, removeOverlayFilter, ensureOverlayFilter],
  );

  const deleteTag = useCallback(
    (tag: string) => {
      setStickersPersist((prev) =>
        prev.map((s) =>
          s.tags.includes(tag)
            ? { ...s, tags: s.tags.filter((t) => t !== tag), updatedAt: Date.now() }
            : s,
        ),
      );
      setTagsPersist((prev) => prev.filter((t) => t !== tag));
      removeOverlayFilter(overlayTagKey(tag));
    },
    [setStickersPersist, setTagsPersist, removeOverlayFilter],
  );

  const categoriesRef = useRef<Category[]>([]);
  categoriesRef.current = categories;

  const deleteStickers = useCallback((ids: string[]) => {
    const toDeleteSet = new Set(ids);
    const victims = stickersRef.current.filter((s) => toDeleteSet.has(s.id));
    setStickersPersist((prev) => prev.filter((s) => !toDeleteSet.has(s.id)));
    setTimeout(() => deleteStickerFiles(victims), 0);
  }, [setStickersPersist]);

  const createCategory = useCallback(
    (name: string, parentId: string | null = null, icon = 'folder-outline'): Category | null => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const now = Date.now();
      const cat: Category = {
        id: uuid(),
        name: trimmed,
        icon,
        parentId,
        createdAt: now,
        updatedAt: now,
        isSystem: false,
      };
      setCategoriesPersist((prev) => [...prev, cat]);
      return cat;
    },
    [setCategoriesPersist],
  );

  const renameCategory = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setCategoriesPersist((prev) =>
        prev.map((c) => (c.id === id ? { ...c, name: trimmed, updatedAt: Date.now() } : c)),
      );
    },
    [setCategoriesPersist],
  );

  const deleteCategory = useCallback(
    (id: string) => {
      setCategoriesPersist((prev) => {
        const removeIds = new Set(collectCategoryAndDescendants(id, prev));
        return prev.filter((c) => !removeIds.has(c.id));
      });
      setStickersPersist((prev) => {
        const removeIds = new Set(collectCategoryAndDescendants(id, categoriesRef.current));
        return prev.map((s) =>
          s.categoryId && removeIds.has(s.categoryId) ? { ...s, categoryId: null, updatedAt: Date.now() } : s,
        );
      });
    },
    [setCategoriesPersist, setStickersPersist],
  );

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next).catch((e) => console.warn('[store] save settings failed', e));
      return next;
    });
  }, []);

  const value = useMemo<StoreValue>(() => {
    const favorites = stickers.filter((s) => s.isFavorite);
    const viewCategories: ViewCategory[] = [
      { id: 'cat__all', name: '全部', icon: 'image-multiple-outline', isVirtual: true },
      { id: 'cat__recents', name: '最近使用', icon: 'clock-outline', isVirtual: true },
      { id: 'cat__favorites', name: '收藏', icon: 'star', isVirtual: true },
      ...categories,
    ];
    return {
      stickers,
      categories,
      settings,
      loaded,
      favorites,
      allTags,
      viewCategories,
      importFromLibrary,
      importFromFiles,
      importFromClipboard,
      toggleFavorite,
      touchSticker,
      renameSticker,
      setStickerCategory,
      moveStickersToCategory,
      setStickerTags,
      addTagsToStickers,
      removeTagsFromStickers,
      createTag,
      renameTag,
      deleteTag,
      deleteStickers,
      createCategory,
      renameCategory,
      deleteCategory,
      updateSettings,
    };
  }, [
    stickers,
    categories,
    settings,
    loaded,
    allTags,
    importFromLibrary,
    importFromFiles,
    importFromClipboard,
    toggleFavorite,
    touchSticker,
    renameSticker,
    setStickerCategory,
    moveStickersToCategory,
    setStickerTags,
    addTagsToStickers,
    removeTagsFromStickers,
    createTag,
    renameTag,
    deleteTag,
    deleteStickers,
    createCategory,
    renameCategory,
    deleteCategory,
    updateSettings,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
