/**
 * Filter chips shown in the floating "quick send" window.
 *
 * The "全部" chip is always present (it resets the active filter).
 * Static quick filters can be toggled on/off; every app tag is also exposed
 * as an optional filter chip using the key `tag:<name>`.
 */
export const OVERLAY_FILTER_OPTIONS: { key: string; label: string }[] = [
  { key: 'recent', label: '最近' },
  { key: 'favorite', label: '收藏' },
  { key: 'frequent', label: '高频' },
];

/** Keys that older builds used for format chips; they are no longer configurable. */
export const LEGACY_OVERLAY_FILTER_KEYS = ['png', 'jpg', 'gif', 'webp', 'heic', 'other'];

/** Default set of enabled overlay filter chips (static quick filters). */
export const DEFAULT_OVERLAY_FILTERS: string[] = OVERLAY_FILTER_OPTIONS.map((o) => o.key);

/** Builds the tag filter key stored in settings for a given tag name. */
export function overlayTagKey(tag: string): string {
  return `tag:${tag}`;
}

/** Parses a stored filter key back to a tag name, or null if not a tag filter. */
export function tagFromOverlayKey(key: string): string | null {
  return key.startsWith('tag:') ? key.slice('tag:'.length) : null;
}
