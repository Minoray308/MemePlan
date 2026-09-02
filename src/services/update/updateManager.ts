import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTO_CHECK_INTERVAL_MS } from '../../constants/update';
import { canInstallApk, fetchVersionInfo, getCurrentVersion, buildUpdateInfo } from './updateApi';
import { compareVersions } from './updateLogic';
import type { AppUpdateInfo, CheckResult, UpdateCheckErrorCode } from './updateTypes';
import { UpdateCheckError } from './updateTypes';

// v4 also stored failed checks; do not inherit those six-hour lockouts.
const LAST_CHECK_KEY = 'update:lastSuccessfulCheckAt:v5';
let checkInFlight: Promise<CheckResult> | null = null;

async function getLastCheckAt(): Promise<number | null> {
  try {
    const value = Number(await AsyncStorage.getItem(LAST_CHECK_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch { return null; }
}

async function performCheck(): Promise<CheckResult> {
  try {
    const release = await fetchVersionInfo();
    try { await AsyncStorage.setItem(LAST_CHECK_KEY, String(Date.now())); } catch {}
    const currentVersion = getCurrentVersion();
    if (compareVersions(release.latestVersion, currentVersion) <= 0) return { outcome: 'latest', info: null };
    const info = buildUpdateInfo(release, currentVersion, 'apk', false);
    return canInstallApk() && info.apkUrl ? { outcome: 'apk', info } : { outcome: 'unavailable', info };
  } catch (error) {
    const err = error instanceof UpdateCheckError ? error : new UpdateCheckError('network');
    console.warn('[update] release check failed', err.code);
    return { outcome: 'error', info: null, code: err.code, message: err.message };
  }
}

export async function checkForUpdate(force = false): Promise<CheckResult> {
  if (checkInFlight) return checkInFlight;
  if (!force) {
    const last = await getLastCheckAt();
    // A manual check may have started while storage was being read.
    if (checkInFlight) return checkInFlight;
    if (last != null && Date.now() - last < AUTO_CHECK_INTERVAL_MS) return { outcome: 'latest', info: null };
  }
  checkInFlight = performCheck().finally(() => { checkInFlight = null; });
  return checkInFlight;
}

export type { CheckResult, AppUpdateInfo, UpdateCheckErrorCode };
