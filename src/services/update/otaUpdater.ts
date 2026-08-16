import * as Updates from 'expo-updates';

export interface OtaCheckResult {
  /** A JS update is available and can be downloaded + reloaded in-app. */
  available: boolean;
  /** expo-updates is disabled (Expo Go / dev / misconfiguration). */
  disabled: boolean;
}

/**
 * Checks whether an OTA (JS) update is actually available through
 * expo-updates for this runtime. Never throws.
 */
export async function checkOtaUpdate(): Promise<OtaCheckResult> {
  if (!Updates.isEnabled) return { available: false, disabled: true };
  try {
    const result = await Updates.checkForUpdateAsync();
    if (result.isAvailable) return { available: true, disabled: false };
    return { available: false, disabled: false };
  } catch (e) {
    console.warn('[update] OTA check failed', e);
    return { available: false, disabled: false };
  }
}

/**
 * Downloads the OTA update and reloads the app. Throws when the download
 * fails; the caller must make sure failures never crash the app.
 */
export async function applyOtaUpdate(): Promise<void> {
  if (!Updates.isEnabled) throw new Error('expo-updates is disabled');
  await Updates.fetchUpdateAsync();
  await Updates.reloadAsync();
}
