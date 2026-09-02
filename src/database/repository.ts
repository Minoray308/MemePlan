import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Category, Settings, Sticker } from '../models/types';
import { STORAGE_KEYS } from '../constants';
import { DEFAULT_OVERLAY_FILTERS, LEGACY_OVERLAY_FILTER_KEYS } from '../constants/overlay';

/**
 * Data access layer. Uses AsyncStorage (local persistence) with a JSON payload.
 * Kept behind this module so the backing store can be swapped for SQLite later
 * without touching the UI / services.
 */

async function loadJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return null;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn(`[db] failed to read ${key}`, e);
    return null;
  }
}

async function saveJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function loadStickers(): Promise<Sticker[]> {
  const data = await loadJson<Sticker[]>(STORAGE_KEYS.stickers);
  return Array.isArray(data) ? data : [];
}

export async function saveStickers(stickers: Sticker[]): Promise<void> {
  await saveJson(STORAGE_KEYS.stickers, stickers);
}

export async function loadCategories(): Promise<Category[]> {
  const data = await loadJson<Category[]>(STORAGE_KEYS.categories);
  return Array.isArray(data) ? data : [];
}

export async function saveCategories(categories: Category[]): Promise<void> {
  await saveJson(STORAGE_KEYS.categories, categories);
}

export async function loadTags(): Promise<string[]> {
  const data = await loadJson<string[]>(STORAGE_KEYS.tags);
  return Array.isArray(data) ? data : [];
}

export async function saveTags(tags: string[]): Promise<void> {
  await saveJson(STORAGE_KEYS.tags, tags);
}

export const DEFAULT_SETTINGS: Settings = {
  gridColumns: 3,
  sortOrder: 'recent',
  generateThumbnails: false,
  themeMode: 'system',
  themeColor: '#2F7048',
  showFormatLabel: true,
  animateGifs: true,
  overlayFilters: [...DEFAULT_OVERLAY_FILTERS],
  exitAfterOverlay: true,
};

const LEGACY_THEME_COLORS: Record<string, string> = {
  '#3B8C5A': '#2F7048',
  '#5B8DEF': '#3E6FA8',
  '#F5A623': '#B66A0A',
  '#E85D75': '#B84A5F',
  '#8B5CF6': '#6D45C7',
};

export async function loadSettings(): Promise<Settings> {
  const data = await loadJson<Partial<Settings>>(STORAGE_KEYS.settings);
  if (!data) return DEFAULT_SETTINGS;
  const merged = { ...DEFAULT_SETTINGS, ...data };
  if (
    Array.isArray(merged.overlayFilters) &&
    merged.overlayFilters.some((key) => LEGACY_OVERLAY_FILTER_KEYS.includes(key))
  ) {
    // Older builds stored format-chip keys; the floating window now uses
    // quick filters + tags instead, so reset to the new defaults once.
    merged.overlayFilters = [...DEFAULT_OVERLAY_FILTERS];
    saveSettings(merged).catch((e) => console.warn('[db] migrate overlay filters failed', e));
  }
  if (merged.themeColor && LEGACY_THEME_COLORS[merged.themeColor]) {
    merged.themeColor = LEGACY_THEME_COLORS[merged.themeColor];
    saveSettings(merged).catch((e) => console.warn('[db] migrate theme color failed', e));
  }
  return merged;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await saveJson(STORAGE_KEYS.settings, settings);
}
