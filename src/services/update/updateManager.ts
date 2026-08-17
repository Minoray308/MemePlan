import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTO_CHECK_INTERVAL_MS } from '../../constants/update';
import { canInstallApk, getAppUpdateInfo } from './updateApi';
import type {
  AppUpdateInfo,
  UpdateCheckErrorCode,
  UpdateCheckOutcome,
} from './updateTypes';
import { UpdateCheckError } from './updateTypes';

const LAST_CHECK_KEY = 'update:lastCheckAt:v2';

/** Guards against duplicate checks (manual + automatic racing each other). */
let checkInFlight = false;

export interface CheckResult {
  outcome: UpdateCheckOutcome;
  info: AppUpdateInfo | null;
  code?: UpdateCheckErrorCode;
  message?: string;
}

async function getLastCheckAt(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_CHECK_KEY);
    const value = raw ? Number(raw) : NaN;
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

async function setLastCheckAt(ts: number): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_CHECK_KEY, String(ts));
  } catch {
    // Persisting the timestamp is best-effort only.
  }
}

/**
 * Unified update check against GitHub Releases.
 *
 * - `force = true` (manual "检查更新" button) always checks regardless of any
 *   cached timestamp, so users can always discover the newest release.
 * - `force = false` (app open / foreground) is throttled to one real check
 *   every AUTO_CHECK_INTERVAL_MS (6 hours).
 *
 * Newer build is decided by semver comparison of the running versionName vs
 * the latest release tag. Any failure returns `outcome: 'error'` with a
 * stable `code` + friendly `message` so the app keeps running and the UI can
 * explain what happened.
 */
export async function checkForUpdate(force = false): Promise<CheckResult> {
  if (checkInFlight) return { outcome: 'latest', info: null };
  checkInFlight = true;
  try {
    if (!force) {
      const lastCheckAt = await getLastCheckAt();
      if (lastCheckAt != null && Date.now() - lastCheckAt < AUTO_CHECK_INTERVAL_MS) {
        return { outcome: 'latest', info: null };
      }
    }
    await setLastCheckAt(Date.now());

    const info = await getAppUpdateInfo();
    if (!info) return { outcome: 'latest', info: null };

    // The app only installs APKs on Android with the native module present.
    if (!canInstallApk()) {
      return { outcome: 'unavailable', info };
    }
    return { outcome: 'apk', info };
  } catch (e) {
    const err = e instanceof UpdateCheckError ? e : new UpdateCheckError('network');
    console.warn('[update] GitHub release check failed', e);
    return { outcome: 'error', info: null, code: err.code, message: err.message };
  } finally {
    checkInFlight = false;
  }
}
