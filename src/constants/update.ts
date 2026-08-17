/**
 * Update-check configuration — GitHub Releases is the single source of truth.
 *
 * The app checks for updates against the public GitHub Releases API of the
 * configured repository (anonymous, no token required):
 *   https://api.github.com/repos/<OWNER>/<REPO>/releases/latest
 *
 * OWNER / REPO are defined once here so they are never duplicated anywhere in
 * the code (see src/services/update/updateApi.ts).
 */
export const GITHUB_OWNER = 'Minoray803';
export const GITHUB_REPO = 'memeplan';

/** Base URL of the GitHub Releases API for this repository. */
export const GITHUB_RELEASES_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;

/** "Latest release" endpoint used by the update check. */
export const GITHUB_RELEASES_LATEST_URL = `${GITHUB_RELEASES_API_URL}/latest`;

/** Network timeout (ms) for the GitHub API request. */
export const GITHUB_API_TIMEOUT_MS = 10_000;

/**
 * Minimum delay between automatic (app-open / app-foreground) checks. The
 * user can always force a fresh check from the Settings "检查更新" button.
 */
export const AUTO_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Preferred APK names when a release ships several APKs, most portable first.
 * This project builds arm64-v8a + armeabi-v7a (see app.json buildArchs), so a
 * universal APK is preferred, then the native ABIs, then x86 as a fallback.
 * See findApkAsset() in src/services/update/updateApi.ts.
 */
export const APK_NAME_PRIORITY = [
  'universal',
  'arm64-v8a',
  'armeabi-v7a',
  'arm64',
  'x86_64',
  'x86',
  'armeabi',
] as const;
