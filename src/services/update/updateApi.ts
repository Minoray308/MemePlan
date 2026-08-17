import { Platform } from 'react-native';
import { GITHUB_API_TIMEOUT_MS, GITHUB_RELEASES_LATEST_URL } from '../../constants/update';
import { AppUpdater } from '../../../modules/app-updater/src';
import type { AppUpdateInfo, GitHubRelease, GitHubReleaseAsset } from './updateTypes';
import { UpdateCheckError } from './updateTypes';
import {
  compareVersions,
  findApkAsset,
  hashForApkFromText,
  stripLeadingV,
} from './updateLogic';

/** Running Android versionCode, or null when it cannot be read (iOS / web /
 * Expo Go / dev builds without the native module). Display only. */
export function getRunningVersionCode(): number | null {
  if (Platform.OS !== 'android') return null;
  const code = AppUpdater.getVersionCode();
  return code != null && code > 0 ? code : null;
}

/** Running Android versionName (semver) of the installed build. */
export function getCurrentVersion(): string {
  if (Platform.OS === 'android') {
    const name = AppUpdater.getVersionName();
    if (name && name.trim().length > 0) return name.trim();
  }
  return '0.0.0';
}

/** True only on Android builds that include the AppUpdater native module. */
export function canInstallApk(): boolean {
  return Platform.OS === 'android' && AppUpdater.isAvailable();
}

// ---------------------------------------------------------------------------
// GitHub Releases API
// ---------------------------------------------------------------------------

async function parseRelease(raw: unknown): Promise<GitHubRelease> {
  if (typeof raw !== 'object' || raw === null) throw new UpdateCheckError('parse');
  const r = raw as Record<string, unknown>;
  if (typeof r.tag_name !== 'string') throw new UpdateCheckError('parse');
  const assets: GitHubReleaseAsset[] = Array.isArray(r.assets)
    ? r.assets
        .filter((a): a is Record<string, unknown> => typeof a === 'object' && a !== null)
        .map((a) => ({
          name: typeof a.name === 'string' ? a.name : '',
          browserDownloadUrl:
            typeof a.browser_download_url === 'string' ? a.browser_download_url : '',
          size: typeof a.size === 'number' ? a.size : 0,
          contentType: typeof a.content_type === 'string' ? a.content_type : '',
        }))
    : [];
  return {
    tagName: r.tag_name,
    name: typeof r.name === 'string' && r.name.length > 0 ? r.name : null,
    body: typeof r.body === 'string' && r.body.length > 0 ? r.body : null,
    htmlUrl: typeof r.html_url === 'string' ? r.html_url : '',
    publishedAt: typeof r.published_at === 'string' ? r.published_at : null,
    assets,
  };
}

/**
 * Fetches `https://api.github.com/repos/<OWNER>/<REPO>/releases/latest`.
 * Throws UpdateCheckError with a stable code on any failure (403/429 -> rate
 * limit, network/timeout, bad JSON, no release). No GitHub token is used.
 */
export async function fetchLatestRelease(): Promise<GitHubRelease> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GITHUB_API_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(GITHUB_RELEASES_LATEST_URL, {
      method: 'GET',
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    });
  } catch (e) {
    const abort =
      e && typeof e === 'object' && (e as { name?: string }).name === 'AbortError';
    throw abort ? new UpdateCheckError('timeout') : new UpdateCheckError('network');
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    if (response.status === 403 || response.status === 429) {
      throw new UpdateCheckError('rate_limit');
    }
    if (response.status === 404) {
      // Repo not found or no releases published yet.
      throw new UpdateCheckError('no_release');
    }
    throw new UpdateCheckError('http');
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new UpdateCheckError('parse');
  }
  return parseRelease(data);
}

// ---------------------------------------------------------------------------
// Optional SHA-256 (GitHub does not add checksums automatically)
// ---------------------------------------------------------------------------

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Tries to find a SHA-256 for the chosen APK, in priority order:
 *   1. a sibling asset named "<apk>.sha256",
 *   2. a SHA256SUMS / sha256sums / checksums asset containing a line for it,
 *   3. the release notes themselves.
 * Returns null (no verification) when the author did not publish one.
 */
export async function findSha256(
  release: GitHubRelease,
  apkName: string,
): Promise<string | null> {
  const lowerName = apkName.toLowerCase();
  const baseName = lowerName.replace(/\.apk$/, '');

  // 1) Sibling "<apk>.sha256" asset.
  for (const asset of release.assets) {
    const a = asset.name.toLowerCase();
    if (a.endsWith('.apk')) continue;
    if (a === `${lowerName}.sha256` || a === `${baseName}.sha256`) {
      const text = await fetchText(asset.browserDownloadUrl);
      const hash = text ? hashForApkFromText(text, apkName) : null;
      if (hash) return hash;
    }
  }

  // 2) A SHA256SUMS / checksums asset.
  for (const asset of release.assets) {
    const a = asset.name.toLowerCase();
    if (a.endsWith('.apk')) continue;
    if (a.includes('sha256sum') || a.includes('checksum')) {
      const text = await fetchText(asset.browserDownloadUrl);
      const hash = text ? hashForApkFromText(text, apkName) : null;
      if (hash) return hash;
    }
  }

  // 3) Release notes.
  if (release.body) {
    const hash = hashForApkFromText(release.body, apkName);
    if (hash) return hash;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

/**
 * Checks GitHub Releases for a newer APK than the running app. Returns
 * AppUpdateInfo when there is a newer APK, or null when the running version is
 * already the latest. Throws UpdateCheckError on a fetch/parse/asset problem
 * so the caller (updateManager) can surface a specific message.
 */
export async function getAppUpdateInfo(): Promise<AppUpdateInfo | null> {
  const currentVersion = getCurrentVersion();
  const release = await fetchLatestRelease();
  const latestVersion = stripLeadingV(release.tagName);
  if (!latestVersion) throw new UpdateCheckError('parse');

  // If remote <= current, there is nothing to update.
  if (compareVersions(latestVersion, currentVersion) <= 0) return null;

  const apk = findApkAsset(release);
  if (!apk) throw new UpdateCheckError('no_apk');

  const sha256 = await findSha256(release, apk.name);

  return {
    version: latestVersion,
    latestVersion,
    tagName: release.tagName,
    currentVersion,
    updateType: 'apk',
    apkUrl: apk.browserDownloadUrl,
    apkName: apk.name,
    sha256: sha256 ?? undefined,
    changelog: release.body ?? undefined,
    releaseTitle: release.name ?? release.tagName,
    releaseUrl: release.htmlUrl || undefined,
  };
}

