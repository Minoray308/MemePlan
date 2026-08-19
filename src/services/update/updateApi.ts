import { Platform } from 'react-native';
import { UPDATE_API_TIMEOUT_MS, UPDATE_API_VERSION_URL } from '../../constants/update';
import { AppUpdater } from '../../../modules/app-updater/src';
import type { AppUpdateInfo, ServerUpdateInfo, UpdateType } from './updateTypes';
import { UpdateCheckError } from './updateTypes';
import {
  isHttpsUrl,
  mapServerStatusToCode,
  parseServerUpdateInfoRaw,
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
// Cloudflare version-check API
// ---------------------------------------------------------------------------

/**
 * Fetches `GET <UPDATE_API_VERSION_URL>?platform=android` from the Cloudflare
 * Worker. Throws UpdateCheckError with a stable code on any failure
 * (network/timeout, HTTP error, bad JSON).
 */
export async function fetchVersionInfo(): Promise<ServerUpdateInfo> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPDATE_API_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${UPDATE_API_VERSION_URL}?platform=android`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
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
    throw new UpdateCheckError(mapServerStatusToCode(response.status));
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new UpdateCheckError('parse');
  }

  try {
    return parseServerUpdateInfoRaw(data);
  } catch {
    throw new UpdateCheckError('parse');
  }
}

/** Builds the client-facing AppUpdateInfo from server metadata + runtime. */
export function buildUpdateInfo(
  server: ServerUpdateInfo,
  currentVersion: string,
  updateType: UpdateType,
  force: boolean,
): AppUpdateInfo {
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
    changelog:
      server.releaseNotes && server.releaseNotes.length > 0
        ? server.releaseNotes.join('\n')
        : undefined,
    releaseTitle:
      server.apkName
        ? `MemePlan v${latestVersion}`
        : `v${latestVersion}`,
    publishedAt: server.publishedAt,
  };
}

export { isHttpsUrl, compareVersions } from './updateLogic';