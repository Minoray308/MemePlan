import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTO_CHECK_INTERVAL_MS } from '../../constants/update';
import { canInstallApk, fetchVersionInfo, getCurrentVersion, buildUpdateInfo } from './updateApi';
import { compareVersions } from './updateLogic';
import type { AppUpdateInfo, CheckResult, UpdateCheckErrorCode } from './updateTypes';
import { UpdateCheckError } from './updateTypes';

const LAST_CHECK_KEY = 'update:lastCheckAt:v4';
let checkInFlight = false;

async function getLastCheckAt(): Promise<number | null> {
  try { const value = Number(await AsyncStorage.getItem(LAST_CHECK_KEY)); return Number.isFinite(value) && value > 0 ? value : null; } catch { return null; }
}
async function setLastCheckAt(value: number): Promise<void> { try { await AsyncStorage.setItem(LAST_CHECK_KEY, String(value)); } catch {} }

/** Checks GitHub releases and reports an installable APK when tag > version. */
export async function checkForUpdate(force = false): Promise<CheckResult> {
  if (checkInFlight) return { outcome: 'latest', info: null };
  checkInFlight = true;
  try {
    if (!force) {
      const last = await getLastCheckAt();
      if (last != null && Date.now() - last < AUTO_CHECK_INTERVAL_MS) return { outcome: 'latest', info: null };
    }
    await setLastCheckAt(Date.now());
    const release = await fetchVersionInfo();
    const currentVersion = getCurrentVersion();
    if (compareVersions(release.latestVersion, currentVersion) <= 0) return { outcome: 'latest', info: null };
    const info = buildUpdateInfo(release, currentVersion, 'apk', false);
    return canInstallApk() && info.apkUrl ? { outcome: 'apk', info } : { outcome: 'unavailable', info };
  } catch (e) {
    const err = e instanceof UpdateCheckError ? e : new UpdateCheckError('network');
    console.warn('[update] GitHub release check failed', e);
    return { outcome: 'error', info: null, code: err.code, message: err.message };
  } finally { checkInFlight = false; }
}

export type { CheckResult, AppUpdateInfo, UpdateCheckErrorCode };
