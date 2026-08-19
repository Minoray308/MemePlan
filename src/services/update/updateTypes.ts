/**
 * Types for the update system. The source of truth is the Cloudflare
 * version-check API (see src/services/update/updateApi.ts); a newer build is
 * decided by numeric semver comparison of the running versionName against the
 * API's latest/minimum versions. Small (JS) updates go through expo-updates
 * (OTA); large updates install an APK downloaded from Cloudflare R2.
 */

/** The payload returned by the Cloudflare Worker (see cloudflare/worker/src). */
export interface ServerUpdateInfo {
  platform: 'android';
  latestVersion: string;
  minimumVersion: string;
  forceUpdate: boolean;
  apkUrl?: string;
  apkName?: string;
  sha256?: string;
  releaseNotes?: string[];
  publishedAt?: string;
  ota?: {
    enabled: boolean;
    runtimeVersion?: string;
  };
}

/** How an available update is delivered to an Android device. */
export type UpdateType = 'ota' | 'apk';

/**
 * How the update check decided what to report.
 *  - 'latest':      the running build is current.
 *  - 'ota':         a JS (expo-updates) update is available.
 *  - 'apk':         a newer APK is available and installable.
 *  - 'unavailable': a newer build exists but cannot be installed here (e.g. Expo Go).
 *  - 'error':       the check failed (see `code`/`message`).
 */
export type UpdateCheckOutcome = 'latest' | 'ota' | 'apk' | 'unavailable' | 'error';

/** Stable error codes surfaced to the UI with a friendly message. */
export type UpdateCheckErrorCode =
  | 'network'
  | 'timeout'
  | 'http'
  | 'parse'
  | 'no_release'
  | 'unsupported';

/** Friendly Chinese message for each update-check error code. */
export function defaultUpdateErrorMessage(code: UpdateCheckErrorCode): string {
  switch (code) {
    case 'network':
      return '网络连接异常，请检查网络后重试';
    case 'timeout':
      return '请求超时，请稍后重试';
    case 'http':
      return '检查更新失败，请稍后重试';
    case 'parse':
      return '更新信息解析失败，请稍后重试';
    case 'no_release':
      return '暂无可用版本信息';
    case 'unsupported':
      return '当前环境不支持应用内更新';
  }
}

/** Thrown by the update check; carries a code mapped to a friendly message. */
export class UpdateCheckError extends Error {
  code: UpdateCheckErrorCode;
  constructor(code: UpdateCheckErrorCode, message?: string) {
    super(message ?? defaultUpdateErrorMessage(code));
    this.code = code;
    this.name = 'UpdateCheckError';
  }
}

/**
 * Full update info shown in the UI and consumed by the OTA/APK flows
 * (src/services/update/*.ts).
 */
export interface AppUpdateInfo {
  /** Latest semver without a leading "v" (display, e.g. "1.2.3"). */
  version: string;
  /** Alias of `version`. */
  latestVersion: string;
  /** The running app's semver. */
  currentVersion: string;
  /** Whether this update is forced (current < minimumVersion); cannot be skipped. */
  force: boolean;
  /** How the update is delivered. */
  updateType: UpdateType;
  /** Direct HTTPS download URL of the APK (APK updates only). */
  apkUrl?: string;
  /** APK file name (APK updates only), e.g. "memeplan-1.2.3.apk". */
  apkName?: string;
  /** Optional SHA-256; verified after download when present. */
  sha256?: string;
  /** Changelog / release notes. */
  changelog?: string;
  /** Release title / version label. */
  releaseTitle?: string;
  /** ISO publish timestamp of the newest build, if provided. */
  publishedAt?: string;
}

/**
 * Result of a manual/automatic update check.
 *   - 'latest': no newer build.
 *   - 'ota': a JS update is available.
 *   - 'apk': a newer APK is available and installable.
 *   - 'unavailable': newer build exists but cannot be installed here.
 *   - 'error': the check failed (see `code`/`message`).
 */
export type CheckResult = {
  outcome: UpdateCheckOutcome;
  info: AppUpdateInfo | null;
  code?: UpdateCheckErrorCode;
  message?: string;
};

/** Progress emitted while downloading an APK (native module). */
export interface ApkDownloadProgress {
  bytesDownloaded: number;
  bytesTotal: number;
  /** 0..1 */
  progress: number;
}

/** Human-friendly error produced by the APK flow. */
export interface ApkUpdateError {
  /** Stable machine code, e.g. 'ERR_SHA_256_MISMATCH'. */
  code: string;
  /** Chinese message suitable for the UI. */
  message: string;
}