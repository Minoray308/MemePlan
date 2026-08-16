import { requireOptionalNativeModule, type NativeModule } from 'expo-modules-core';

/** Progress payload emitted while an APK is downloading. */
export interface ApkDownloadProgress {
  /** Bytes written so far. */
  bytesDownloaded: number;
  /** Total bytes expected, or -1 when the server sent no Content-Length. */
  bytesTotal: number;
  /** 0..1 fraction, or 0 while the total size is unknown. */
  progress: number;
}

/** Events emitted by the native AppUpdater module. */
export type AppUpdaterEvents = {
  onDownloadProgress: (payload: ApkDownloadProgress) => void;
};

/** Native methods implemented in modules/app-updater/android. */
declare class NativeAppUpdater extends NativeModule<AppUpdaterEvents> {
  /** Current Android versionCode of the running build. */
  getVersionCode(): number;
  /** Current Android versionName of the running build. */
  getVersionName(): string | null;
  /** Whether this app may install packages ("install unknown apps"). */
  canRequestPackageInstalls(): boolean;
  /** Opens the system "allow installing unknown apps" screen for this app. */
  openInstallPermissionSettings(): Promise<void>;
  /**
   * Downloads an APK into the app cache (temp file -> SHA-256 check -> final
   * file). Resolves with the absolute path of the verified APK.
   */
  downloadApk(url: string, expectedSha256: string | null): Promise<string>;
  /**
   * Hands a downloaded APK to the Android system installer via a FileProvider
   * content:// URI. Returns false only when install permission is missing.
   */
  installApk(filePath: string): Promise<boolean>;
}

const native = requireOptionalNativeModule<NativeAppUpdater>('AppUpdater');

export type AppUpdaterSubscription = { remove(): void };

/**
 * Wraps the native APK-update module with a safe fallback: on clients where
 * the native module is missing (Expo Go, iOS, web) every call degrades to a
 * no-op / false instead of throwing, so the rest of the app keeps working.
 */
export const AppUpdater = {
  isAvailable(): boolean {
    return native != null;
  },

  getVersionCode(): number | null {
    return native ? native.getVersionCode() : null;
  },

  getVersionName(): string | null {
    return native ? native.getVersionName() : null;
  },

  canRequestPackageInstalls(): boolean {
    return native ? native.canRequestPackageInstalls() : false;
  },

  openInstallPermissionSettings(): Promise<void> {
    return native ? native.openInstallPermissionSettings() : Promise.resolve();
  },

  async downloadApk(
    url: string,
    expectedSha256: string | null = null,
    onProgress?: (progress: ApkDownloadProgress) => void,
  ): Promise<string> {
    if (!native) throw new Error('AppUpdater native module is not available');
    const subscription = onProgress ? native.addListener('onDownloadProgress', onProgress) : null;
    try {
      return await native.downloadApk(url, expectedSha256 ?? null);
    } finally {
      subscription?.remove();
    }
  },

  installApk(filePath: string): Promise<boolean> {
    return native ? native.installApk(filePath) : Promise.resolve(false);
  },

  addListener(event: 'onDownloadProgress', listener: AppUpdaterEvents['onDownloadProgress']): AppUpdaterSubscription {
    if (!native) return { remove() {} };
    return native.addListener(event, listener);
  },
};

export default AppUpdater;
