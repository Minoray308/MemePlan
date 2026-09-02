import { Platform } from 'react-native';
import { AppUpdater } from '../../../modules/app-updater/src';
import type { AppUpdateInfo, ServerUpdateInfo, UpdateType } from './updateTypes';
import { stripLeadingV } from './updateLogic';

export function getRunningVersionCode(): number | null {
  if (Platform.OS !== 'android') return null;
  const code = AppUpdater.getVersionCode();
  return code != null && code > 0 ? code : null;
}

export function getCurrentVersion(): string {
  if (Platform.OS === 'android') {
    const name = AppUpdater.getVersionName();
    if (name && name.trim()) return name.trim();
  }
  return '0.0.0';
}

export function canInstallApk(): boolean {
  return Platform.OS === 'android' && AppUpdater.isAvailable();
}

export { fetchVersionInfo } from './releaseFetcher';
export { parseGithubReleaseRaw } from './updateLogic';

export function buildUpdateInfo(server: ServerUpdateInfo, currentVersion: string, updateType: UpdateType, force: boolean): AppUpdateInfo {
  const latestVersion = stripLeadingV(server.latestVersion) || server.latestVersion;
  return {
    version: latestVersion,
    latestVersion,
    currentVersion,
    force,
    updateType,
    apkUrl: server.apkUrl,
    apkName: server.apkName,
    sha256: server.sha256,
    changelog: server.releaseNotes?.join('\n') || undefined,
    releaseTitle: `MemePlan v${latestVersion}`,
    publishedAt: server.publishedAt,
    releaseUrl: server.releaseUrl,
  };
}

export { isHttpsUrl, compareVersions } from './updateLogic';
