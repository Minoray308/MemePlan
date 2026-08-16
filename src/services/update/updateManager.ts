import AsyncStorage from '@react-native-async-storage/async-storage';
import { UPDATE_MIN_CHECK_INTERVAL_MS } from '../../constants/update';
import { getAppUpdateInfo } from './updateApi';
import { checkOtaUpdate } from './otaUpdater';
import { isApkUpdateSupported } from './apkUpdater';
import type { AppUpdateInfo, UpdateCheckOutcome } from './updateTypes';

const LAST_CHECK_KEY = 'update:lastCheckAt:v1';

/** Guards against duplicate checks (manual + automatic racing each other). */
let checkInFlight = false;

export interface CheckResult {
  outcome: UpdateCheckOutcome;
  info: AppUpdateInfo | null;
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
 * Unified update check.
 *
 * - `force = true` always checks (app cold start, manual "检查更新" button).
 * - `force = false` is throttled: no more than one check every 30 minutes
 *   (used for app-foreground checks).
 *
 * The server's `updateType` decides OTA vs APK — never the version numbers.
 * Any failure returns `outcome: 'error'` so the app simply keeps running.
 */
export async function checkForUpdate(force = false): Promise<CheckResult> {
  if (checkInFlight) return { outcome: 'latest', info: null };
  checkInFlight = true;
  try {
    if (!force) {
      const lastCheckAt = await getLastCheckAt();
      if (lastCheckAt != null && Date.now() - lastCheckAt < UPDATE_MIN_CHECK_INTERVAL_MS) {
        return { outcome: 'latest', info: null };
      }
    }
    await setLastCheckAt(Date.now());

    const info = await getAppUpdateInfo();
    if (!info) return { outcome: 'latest', info: null };

    if (info.updateType === 'ota') {
      const ota = await checkOtaUpdate();
      if (!ota.available) {
        // Server advertises OTA, but expo-updates has nothing for this
        // runtime (e.g. the OTA targets a newer native build). Nothing to do.
        if (ota.disabled) return { outcome: 'unavailable', info };
        return { outcome: 'latest', info: null };
      }
      return { outcome: 'ota', info };
    }

    // updateType === 'apk'
    if (!isApkUpdateSupported()) {
      return { outcome: 'unavailable', info };
    }
    return { outcome: 'apk', info };
  } catch (e) {
    console.warn('[update] check failed', e);
    return { outcome: 'error', info: null };
  } finally {
    checkInFlight = false;
  }
}
