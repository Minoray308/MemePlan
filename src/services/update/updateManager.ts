import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTO_CHECK_INTERVAL_MS } from '../../constants/update';
import { canInstallApk, fetchVersionInfo, getCurrentVersion, buildUpdateInfo } from './updateApi';
import { checkOtaUpdate } from './otaUpdater';
import {
  decideUpdate,
  type UpdateDecision,
} from './updateLogic';
import type {
  AppUpdateInfo,
  CheckResult,
  ServerUpdateInfo,
  UpdateCheckErrorCode,
} from './updateTypes';
import { UpdateCheckError } from './updateTypes';

const LAST_CHECK_KEY = 'update:lastCheckAt:v3';

/** Guards against duplicate checks (manual + automatic racing each other). */
let checkInFlight = false;

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

/** Maps the pure decision + runtime capabilities into a CheckResult. */
async function resolveDecision(
  server: ServerUpdateInfo,
  decision: UpdateDecision,
): Promise<CheckResult> {
  const currentVersion = getCurrentVersion();

  if (decision.kind === 'force_apk') {
    const info = buildUpdateInfo(server, currentVersion, 'apk', true);
    if (!canInstallApk()) return { outcome: 'unavailable', info };
    return { outcome: 'apk', info };
  }

  // Not forced: small JS (OTA) update first — expo-updates owns availability.
  const otaResult = await checkOtaUpdate();
  if (otaResult.available) {
    return {
      outcome: 'ota',
      info: buildUpdateInfo(server, currentVersion, 'ota', false),
    };
  }

  if (decision.kind === 'apk') {
    const info = buildUpdateInfo(server, currentVersion, 'apk', false);
    if (!canInstallApk()) return { outcome: 'unavailable', info };
    return { outcome: 'apk', info };
  }

  if (decision.kind === 'requires_apk_without_url') {
    const info = buildUpdateInfo(server, currentVersion, 'apk', false);
    return { outcome: 'unavailable', info };
  }

  // 'latest' — but a JS update may still be published without a version bump,
  // which expo-updates already determined via checkOtaUpdate() above.
  return { outcome: 'latest', info: null };
}

/**
 * Unified update check against the Cloudflare version-check API.
 *
 * - `force = true` (manual "检查更新" button) always checks regardless of any
 *   cached timestamp, so users can always discover the newest version.
 * - `force = false` (app open / foreground) is throttled to one real check
 *   every AUTO_CHECK_INTERVAL_MS (6 hours).
 *
 * Small updates come from expo-updates (OTA), large updates install an APK
 * from the API's R2 URL, and a current < minimumVersion forces the update.
 * Any failure returns `outcome: 'error'` with a stable `code` + friendly
 * `message` so the app keeps running and the UI can explain what happened.
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

    const server = await fetchVersionInfo();
    const currentVersion = getCurrentVersion();
    const otaEnabled = server.ota ? server.ota.enabled : true;
    const hasApk = typeof server.apkUrl === 'string' && server.apkUrl.length > 0;

    const decision = decideUpdate({
      currentVersion,
      latestVersion: server.latestVersion,
      minimumVersion: server.minimumVersion,
      otaEnabled,
      hasApk,
    });

    return await resolveDecision(server, decision);
  } catch (e) {
    const err = e instanceof UpdateCheckError ? e : new UpdateCheckError('network');
    console.warn('[update] version check failed', e);
    return { outcome: 'error', info: null, code: err.code, message: err.message };
  } finally {
    checkInFlight = false;
  }
}

export type { CheckResult };
export type { AppUpdateInfo, UpdateCheckErrorCode };