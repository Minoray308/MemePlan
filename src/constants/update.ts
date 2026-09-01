/** GitHub repository used by the Kazumi-style release checker. */
export const GITHUB_REPOSITORY =
  process.env.EXPO_PUBLIC_GITHUB_REPOSITORY ?? 'Minoray308/MemePlan';

/** Public GitHub Releases API endpoint. */
export const GITHUB_LATEST_RELEASE_URL =
  `https://api.github.com/repos/${GITHUB_REPOSITORY}/releases/latest`;

/** Network timeout (ms) for the release check request. */
export const UPDATE_API_TIMEOUT_MS = 10_000;

/** Minimum delay between automatic checks; manual checks always bypass it. */
export const AUTO_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
