/** How the server wants this update delivered. */
export type UpdateType = 'ota' | 'apk';

/**
 * Version info returned by the update server (or the embedded fallback).
 * `versionCode` is the single source of truth for "is there a newer build";
 * `version` is only used for UI display.
 */
export interface AppUpdateInfo {
  /** Display version, e.g. "2.5.0". */
  version: string;
  /** Android versionCode — update only when > running versionCode. */
  versionCode: number;
  /** Server decides: OTA (expo-updates) or APK (in-app download). */
  updateType: UpdateType;
  /** Direct HTTPS APK URL (required when updateType === 'apk'). */
  apkUrl?: string;
  /** Optional SHA-256 of the APK; verified after download. */
  sha256?: string;
  /** Optional release notes shown in the update dialog. */
  changelog?: string;
}

/** Result of a manual/automatic update check. */
export type UpdateCheckOutcome =
  /** No newer build / server says nothing to do. */
  | 'latest'
  /** An OTA (JS) update is available and can be applied in-app. */
  | 'ota'
  /** A native APK update is available. */
  | 'apk'
  /** An update exists but cannot be performed on this client (e.g. Expo Go). */
  | 'unavailable'
  /** The check itself failed — the app simply continues normally. */
  | 'error';

/** Progress emitted while downloading an APK. */
export interface ApkDownloadProgress {
  bytesDownloaded: number;
  bytesTotal: number;
  /** 0..1 */
  progress: number;
}

/** Human-friendly error produced by the APK flow. */
export interface ApkUpdateError {
  /** Stable machine code, e.g. 'sha256_mismatch'. */
  code: string;
  /** Chinese message suitable for the UI. */
  message: string;
}
