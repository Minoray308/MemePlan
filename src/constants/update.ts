/**
 * Update-check configuration.
 *
 * Set UPDATE_API_URL to your own version endpoint (see src/services/update/
 * updateApi.ts for the exact response shape). When it is null, the app falls
 * back to the embedded VERSION_INFO constant (src/constants/versionInfo.ts).
 */
export const UPDATE_API_URL: string | null = null;
/** Headers sent with the version request (e.g. auth tokens). */
export const UPDATE_API_HEADERS: Record<string, string> = {};
/** Network timeout for the version request. */
export const UPDATE_API_TIMEOUT_MS = 10_000;
/** Minimum delay between automatic (background-resume) checks. */
export const UPDATE_MIN_CHECK_INTERVAL_MS = 30 * 60 * 1000;
