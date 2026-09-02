import { Platform } from 'react-native';
import { GITHUB_LATEST_RELEASE_URL, UPDATE_API_TIMEOUT_MS } from '../../constants/update';
import { AppUpdater } from '../../../modules/app-updater/src';
import type { AppUpdateInfo, ServerUpdateInfo, UpdateType } from './updateTypes';
import { UpdateCheckError } from './updateTypes';
import { stripLeadingV } from './updateLogic';

export function getRunningVersionCode(): number | null {
  if (Platform.OS !== 'android') return null;
  const code = AppUpdater.getVersionCode();
  return code != null && code > 0 ? code : null;
}

export function getCurrentVersion(): string {
  if (Platform.OS === 'android') {
    const name = AppUpdater.getVersionName();
    if (name && name.trim()) return name.trim();
  }
  return '0.0.0';
}

export function canInstallApk(): boolean {
  return Platform.OS === 'android' && AppUpdater.isAvailable();
}

/** Fetches the latest GitHub Release, matching Kazumi's release-based check. */
export async function fetchVersionInfo(): Promise<ServerUpdateInfo> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPDATE_API_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(GITHUB_LATEST_RELEASE_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    });
  } catch (e) {
    throw new UpdateCheckError(
      e && typeof e === 'object' && (e as { name?: string }).name === 'AbortError'
        ? 'timeout'
        : 'network',
    );
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    throw new UpdateCheckError(response.status === 404 ? 'no_release' : 'http');
  }
  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw new UpdateCheckError('parse');
  }
  try {
    return parseGithubReleaseRaw(raw);
  } catch {
    throw new UpdateCheckError('parse');
  }
}

/** Normalizes GitHub tag_name, body and APK assets into the app model. */
export function parseGithubReleaseRaw(raw: unknown): ServerUpdateInfo {
  if (typeof raw !== 'object' || raw === null) throw new Error('invalid release');
  const release = raw as Record<string, unknown>;
  if (typeof release.tag_name !== 'string' || release.draft === true) throw new Error('invalid release');
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const apk = assets
    .filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
    .filter((x) => typeof x.name === 'string' && /\.apk$/i.test(x.name))
    .find((x) => typeof x.browser_download_url === 'string');
  return {
    platform: 'android',
    latestVersion: stripLeadingV(release.tag_name),
    minimumVersion: '0.0.0',
    forceUpdate: false,
    apkUrl: apk && typeof apk.browser_download_url === 'string' ? apk.browser_download_url : undefined,
    apkName: apk && typeof apk.name === 'string' ? apk.name : undefined,
    releaseNotes: typeof release.body === 'string' && release.body.trim() ? [release.body] : undefined,
    publishedAt: typeof release.published_at === 'string' ? release.published_at : undefined,
    releaseUrl: typeof release.html_url === 'string' ? release.html_url : undefined,
  };
}

export function buildUpdateInfo(server: ServerUpdateInfo, currentVersion: string, updateType: UpdateType, force: boolean): AppUpdateInfo {
  const latestVersion = stripLeadingV(server.latestVersion) || server.latestVersion;
  return {
    version: latestVersion,
    latestVersion,
    currentVersion,
    force,
    updateType,
    apkUrl: server.apkUrl,
    apkName: server.apkName,
    sha256: server.sha256,
    changelog: server.releaseNotes?.join('\n') || undefined,
    releaseTitle: `MemePlan v${latestVersion}`,
    publishedAt: server.publishedAt,
    releaseUrl: server.releaseUrl,
  };
}

export { isHttpsUrl, compareVersions } from './updateLogic';
