import { AppUpdater, type ApkDownloadProgress } from '../../../modules/app-updater/src';
import type { ApkUpdateError, AppUpdateInfo } from './updateTypes';

/** Maps native error codes (ERR_*) to friendly Chinese messages. */
const ERROR_MESSAGES: Record<string, string> = {
  ERR_DOWNLOAD_FAILED: '下载失败，请检查网络后重试',
  ERR_HTTP_STATUS: '下载失败，服务器暂时不可用',
  ERR_SHA_256_MISMATCH: '安装包校验失败，请稍后重试',
  ERR_INSTALL_PERMISSION_DENIED: '未获得安装更新所需的权限',
  ERR_INSTALLER_LAUNCH: '无法打开系统安装器，请稍后重试',
  ERR_UNEXPECTED: '更新失败，请稍后重试',
};

function errorCodeOf(e: unknown): string {
  if (e && typeof e === 'object' && 'code' in e) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === 'string' && code.startsWith('ERR_')) return code;
  }
  return 'ERR_DOWNLOAD_FAILED';
}

/** Converts any thrown value into a stable, user-friendly ApkUpdateError. */
export function apkErrorFrom(e: unknown): ApkUpdateError {
  const code = errorCodeOf(e);
  return { code, message: ERROR_MESSAGES[code] ?? ERROR_MESSAGES.ERR_DOWNLOAD_FAILED };
}

function assertHttpsApkUrl(url: string): void {
  try {
    if (new URL(url).protocol !== 'https:') throw new Error('not https');
  } catch {
    throw { code: 'ERR_DOWNLOAD_FAILED', message: ERROR_MESSAGES.ERR_DOWNLOAD_FAILED } satisfies ApkUpdateError;
  }
}

/** True only on Android builds that can install APKs in-app. */
export function isApkUpdateSupported(): boolean {
  return AppUpdater.isAvailable();
}

/** Whether the OS currently allows this app to install packages. */
export function canRequestPackageInstalls(): boolean {
  return AppUpdater.canRequestPackageInstalls();
}

/** Opens the system "allow installing unknown apps" screen for this app. */
export function openInstallPermissionSettings(): Promise<void> {
  return AppUpdater.openInstallPermissionSettings();
}

/**
 * Downloads the APK into the app cache, verifies SHA-256 when the server
 * provided it, and resolves with the path of the verified APK.
 * Throws ApkUpdateError on any failure (temp files are cleaned up natively).
 */
export async function downloadApk(
  info: AppUpdateInfo,
  onProgress?: (progress: ApkDownloadProgress) => void,
): Promise<string> {
  if (!info.apkUrl) throw apkErrorFrom({ code: 'ERR_DOWNLOAD_FAILED' });
  assertHttpsApkUrl(info.apkUrl);
  try {
    return await AppUpdater.downloadApk(info.apkUrl, info.sha256 ?? null, onProgress);
  } catch (e) {
    throw apkErrorFrom(e);
  }
}

/**
 * Hands a verified APK to the Android system installer. Throws
 * ApkUpdateError when the installer cannot be started.
 */
export async function installApk(filePath: string): Promise<void> {
  try {
    const launched = await AppUpdater.installApk(filePath);
    if (!launched) throw { code: 'ERR_INSTALL_PERMISSION_DENIED' };
  } catch (e) {
    throw apkErrorFrom(e);
  }
}
