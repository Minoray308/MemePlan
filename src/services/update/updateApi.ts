import { Platform } from 'react-native';
import {
  UPDATE_API_HEADERS,
  UPDATE_API_TIMEOUT_MS,
  UPDATE_API_URL,
} from '../../constants/update';
import { VERSION_INFO } from '../../constants/versionInfo';
import { AppUpdater } from '../../../modules/app-updater/src';
import type { AppUpdateInfo, UpdateType } from './updateTypes';

/**
 * Running Android versionCode, or null when it cannot be read (iOS / web /
 * Expo Go / dev builds without the native module).
 *
 * This is the single source of truth for "is the server's build newer".
 */
export function getRunningVersionCode(): number | null {
  if (Platform.OS !== 'android') return null;
  const code = AppUpdater.getVersionCode();
  return code != null && code > 0 ? code : null;
}

/** True only on Android builds that include the AppUpdater native module. */
export function canInstallApk(): boolean {
  return Platform.OS === 'android' && AppUpdater.isAvailable();
}

function isHttpsUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Validates and normalizes a raw server payload into AppUpdateInfo. */
function validateUpdateInfo(raw: unknown): AppUpdateInfo | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const version = typeof r.version === 'string' ? r.version.trim() : '';
  const versionCode = typeof r.versionCode === 'number' ? r.versionCode : Number(r.versionCode);
  const updateType = r.updateType as UpdateType;
  if (!version || !Number.isFinite(versionCode) || versionCode <= 0) {
    console.warn('[update] server payload missing version/versionCode');
    return null;
  }
  if (updateType !== 'ota' && updateType !== 'apk') {
    console.warn('[update] server payload has invalid updateType', updateType);
    return null;
  }

  const apkUrl = typeof r.apkUrl === 'string' && r.apkUrl.trim().length > 0 ? r.apkUrl.trim() : undefined;
  if (updateType === 'apk' && (!apkUrl || !isHttpsUrl(apkUrl))) {
    console.warn('[update] APK update without a valid HTTPS apkUrl');
    return null;
  }

  const sha256 = typeof r.sha256 === 'string' && r.sha256.trim().length > 0 ? r.sha256.trim() : undefined;
  const changelog =
    typeof r.changelog === 'string' && r.changelog.trim().length > 0 ? r.changelog.trim() : undefined;

  return { version, versionCode, updateType, apkUrl, sha256, changelog };
}

/** Fetches the update info from the configured server endpoint (null on any failure). */
async function fetchServerUpdateInfo(): Promise<AppUpdateInfo | null> {
  if (!UPDATE_API_URL) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPDATE_API_TIMEOUT_MS);
  try {
    const response = await fetch(UPDATE_API_URL, {
      method: 'GET',
      headers: UPDATE_API_HEADERS,
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn(`[update] version API responded ${response.status}`);
      return null;
    }
    return validateUpdateInfo(await response.json());
  } catch (e) {
    console.warn('[update] version API request failed', e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Offline fallback: the version info embedded in the JS bundle. Only used when
 * no server is configured (UPDATE_API_URL is null) or the server is
 * unreachable. Requires `versionCode > 0` so the comparison stays correct.
 */
function embeddedUpdateInfo(): AppUpdateInfo | null {
  const { versionName, versionCode, apkUrl, sha256, changelog } = VERSION_INFO;
  if (versionCode <= 0 || !apkUrl || !isHttpsUrl(apkUrl)) return null;
  const runningVersionCode = getRunningVersionCode();
  if (runningVersionCode == null || versionCode <= runningVersionCode) return null;
  return { version: versionName, versionCode, updateType: VERSION_INFO.updateType, apkUrl, sha256, changelog };
}

/**
 * Returns the update info when there is a newer build (server decides
 * `updateType`), otherwise null. Never throws: every failure just means "no
 * update" and the app keeps running normally.
 */
export async function getAppUpdateInfo(): Promise<AppUpdateInfo | null> {
  let info: AppUpdateInfo | null = null;
  if (UPDATE_API_URL) {
    info = await fetchServerUpdateInfo();
  }
  if (!info) {
    info = embeddedUpdateInfo();
  }
  if (!info) return null;

  const runningVersionCode = getRunningVersionCode();
  if (runningVersionCode != null && info.versionCode <= runningVersionCode) {
    return null;
  }
  return info;
}

