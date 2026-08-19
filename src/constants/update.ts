/**
 * Update-check configuration - Cloudflare is the single source of truth.
 *
 * The app checks for updates against the Cloudflare Worker version-check API:
 *   GET <UPDATE_API_BASE_URL>/api/version?platform=android
 * which returns the latest/minimum version, force-update flag and an optional
 * Cloudflare R2 APK URL (large updates) plus OTA metadata (small updates via
 * expo-updates).
 *
 * The base URL can be overridden at build time with the EXPO_PUBLIC_UPDATE_API_URL
 * environment variable (Expo inlines EXPO_PUBLIC_* at bundle time).
 */
export const UPDATE_API_BASE_URL =
  process.env.EXPO_PUBLIC_UPDATE_API_URL ?? 'https://update.example.com';

/** Full URL of the version-check endpoint. */
export const UPDATE_API_VERSION_URL = `${UPDATE_API_BASE_URL}/api/version`;

/** Network timeout (ms) for the version-check request. */
export const UPDATE_API_TIMEOUT_MS = 10_000;

/**
 * Minimum delay between automatic (app-open / app-foreground) checks. The
 * user can always force a fresh check from the Settings "检查更新" button.
 */
export const AUTO_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours