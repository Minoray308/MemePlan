/**
 * Types for the update system. The source of truth is the GitHub Releases API
 * of this repository; a newer build is decided by semver comparison of the
 * running app's versionName vs the latest release tag (see updateApi.ts).
 */

/** How a GitHub-sourced update is delivered. Android only: in-app APK install. */
export type UpdateType = 'apk';

/** A GitHub Release asset (from the Releases API `assets` array). */
export interface GitHubReleaseAsset {
  name: string;
  browserDownloadUrl: string;
  size: number;
  contentType: string;
}

/** The parts of a GitHub Release the updater cares about (from /releases/latest). */
export interface GitHubRelease {
  /** Raw tag, e.g. "v1.2.3" or "1.2.3". */
  tagName: string;
  /** Release title (`name`), or null. */
  name: string | null;
  /** Release notes / changelog (`body`), or null. */
  body: string | null;
  /** Release page URL (`html_url`). */
  htmlUrl: string;
  /** ISO publish timestamp, or null. */
  publishedAt: string | null;
  assets: GitHubReleaseAsset[];
}

/** Stable error codes surfaced to the UI with a friendly message. */
export type UpdateCheckErrorCode =
  | 'network'
  | 'timeout'
  | 'rate_limit'
  | 'http'
  | 'parse'
  | 'no_apk'
  | 'no_release'
  | 'unsupported';

/** Friendly Chinese message for each update-check error code. */
export function defaultUpdateErrorMessage(code: UpdateCheckErrorCode): string {
  switch (code) {
    case 'network':
      return '网络连接异常，请检查网络后重试';
    case 'timeout':
      return '请求超时，请稍后重试';
    case 'rate_limit':
      return '请求过于频繁，请稍后再试';
    case 'http':
      return '检查更新失败，请稍后重试';
    case 'parse':
      return '更新信息解析失败，请稍后重试';
    case 'no_apk':
      return '最新版本未提供可安装的安装包（APK）';
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
 * Full update info shown in the UI and consumed by the APK download flow
 * (src/services/update/apkUpdater.ts).
 */
export interface AppUpdateInfo {
  /** Latest semver without the leading "v" (display, e.g. "1.2.3"). */
  version: string;
  /** Alias of `version`. */
  latestVersion: string;
  /** Raw GitHub tag, e.g. "v1.2.3". */
  tagName: string;
  /** The running app's semver. */
  currentVersion: string;
  updateType: UpdateType; // always 'apk' for a GitHub-sourced update
  /** Direct HTTPS download URL of the selected APK asset. */
  apkUrl: string;
  /** Asset file name, e.g. "memeplan-1.2.3.apk". */
  apkName: string;
  /** Optional SHA-256; verified after download when present. */
  sha256?: string;
  /** Release notes (body). */
  changelog?: string;
  /** Release title (name). */
  releaseTitle?: string;
  /** Release page URL. */
  releaseUrl?: string;
}

/**
 * Result of a manual/automatic update check.
 *   - 'latest': no newer build.
 *   - 'apk': a newer APK is available and installable.
 *   - 'unavailable': newer build exists but cannot be installed here (Expo Go…).
 *   - 'error': the check failed (see `code`/`message`).
 */
export type UpdateCheckOutcome = 'latest' | 'apk' | 'unavailable' | 'error';

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
