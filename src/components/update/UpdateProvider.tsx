import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { getRunningVersionCode } from '../../services/update/updateApi';
import { checkForUpdate } from '../../services/update/updateManager';
import { applyOtaUpdate } from '../../services/update/otaUpdater';
import {
  apkErrorFrom,
  canRequestPackageInstalls,
  downloadApk,
  installApk,
  openInstallPermissionSettings as openApkInstallSettings,
} from '../../services/update/apkUpdater';
import type {
  ApkDownloadProgress,
  ApkUpdateError,
  AppUpdateInfo,
  UpdateCheckOutcome,
} from '../../services/update/updateTypes';
import { useToast } from '../ToastProvider';
import { UpdateDialog } from './UpdateDialog';
import { UpdateProgress } from './UpdateProgress';
import { UpdatePermissionDialog } from './UpdatePermissionDialog';
import { UpdateErrorDialog } from './UpdateErrorDialog';

type UpdatePhase = 'idle' | 'checking' | 'prompt' | 'downloading' | 'permission' | 'error';

export interface UpdateManagerContextValue {
  phase: UpdatePhase;
  info: AppUpdateInfo | null;
  apkProgress: ApkDownloadProgress | null;
  error: ApkUpdateError | null;
  isChecking: boolean;
  /** Installed Android versionCode of this build (native Android only). */
  runningVersionCode: number | null;
  /** Manual check (Settings "检查更新"). Resolves with the check outcome. */
  checkNow: () => Promise<UpdateCheckOutcome>;
  /** User tapped 立即更新. */
  confirmUpdate: () => void;
  /** User tapped 稍后 / dismissed the current flow. */
  dismiss: () => void;
  /** Retry after an update error. */
  retryUpdate: () => void;
  /** Open the system "allow installing unknown apps" screen. */
  openInstallPermissionSettings: () => void;
}

const UpdateManagerContext = createContext<UpdateManagerContextValue | null>(null);

export function useUpdateManager(): UpdateManagerContextValue {
  const ctx = useContext(UpdateManagerContext);
  if (!ctx) throw new Error('useUpdateManager must be used within UpdateProvider');
  return ctx;
}

/**
 * Owns the whole update lifecycle:
 * - checks once on cold start and on app foreground (>= 30 min apart),
 * - prompts with a non-blocking dialog ([稍后] / [立即更新]),
 * - OTA updates via expo-updates, APK updates via the native AppUpdater
 *   module (download + SHA-256 + install permission + system installer).
 *
 * Any failure simply resets to idle — the app keeps running on the current
 * version. Checks never run inside a React render.
 */
export function UpdateProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const [phase, setPhaseState] = useState<UpdatePhase>('idle');
  const [info, setInfo] = useState<AppUpdateInfo | null>(null);
  const [apkProgress, setApkProgress] = useState<ApkDownloadProgress | null>(null);
  const [error, setError] = useState<ApkUpdateError | null>(null);

  // Refs mirror state so AppState listeners never go stale.
  const phaseRef = useRef<UpdatePhase>('idle');
  const infoRef = useRef<AppUpdateInfo | null>(null);
  const pendingApkPathRef = useRef<string | null>(null);
  const dismissedVersionCodeRef = useRef<number | null>(null);

  const runningVersionCode = useMemo(() => getRunningVersionCode(), []);

  const setPhase = useCallback((next: UpdatePhase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const reset = useCallback(() => {
    pendingApkPathRef.current = null;
    setApkProgress(null);
    setError(null);
    setInfo(null);
    infoRef.current = null;
    setPhase('idle');
  }, [setPhase]);

  const presentPrompt = useCallback(
    (target: AppUpdateInfo) => {
      infoRef.current = target;
      setInfo(target);
      setPhase('prompt');
    },
    [setPhase],
  );

  /** Full APK flow: permission gate -> download -> SHA-256 -> install. */
  const runApkFlow = useCallback(
    async (target: AppUpdateInfo, existingPath: string | null) => {
      try {
        // 1. Permission gate (checked again after download too).
        if (!canRequestPackageInstalls()) {
          setPhase('permission');
          return;
        }

        // 2. Download (skipped when we already have a verified file).
        let path = existingPath;
        if (!path) {
          pendingApkPathRef.current = null;
          setPhase('downloading');
          setApkProgress({ bytesDownloaded: 0, bytesTotal: -1, progress: 0 });
          path = await downloadApk(target, (p) => setApkProgress(p));
          pendingApkPathRef.current = path;
        }

        // 3. Re-check permission (user could have revoked it meanwhile).
        if (!canRequestPackageInstalls()) {
          setPhase('permission');
          return;
        }

        // 4. Hand the verified APK to the system installer.
        setPhase('downloading');
        setApkProgress({ bytesDownloaded: 1, bytesTotal: 1, progress: 1 });
        await installApk(path);
        reset();
      } catch (e) {
        console.warn('[update] APK flow failed', e);
        setError(apkErrorFrom(e));
        setPhase('error');
      }
    },
    [reset, setPhase],
  );

  const runAutoCheck = useCallback(
    async (force: boolean) => {
      if (phaseRef.current !== 'idle') return;
      const result = await checkForUpdate(force);
      if (result.outcome !== 'ota' && result.outcome !== 'apk') return;
      const target = result.info;
      if (!target) return;
      if (dismissedVersionCodeRef.current === target.versionCode) return;
      presentPrompt(target);
    },
    [presentPrompt],
  );

  // Cold-start check (once).
  useEffect(() => {
    const timer = setTimeout(() => runAutoCheck(true), 1500);
    return () => clearTimeout(timer);
  }, [runAutoCheck]);

  // Foreground check (throttled to every 30 min) + resume after the install
  // permission settings screen.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (phaseRef.current === 'permission') {
        const target = infoRef.current;
        if (target) runApkFlow(target, pendingApkPathRef.current);
      } else if (phaseRef.current === 'idle') {
        runAutoCheck(false);
      }
    });
    return () => subscription.remove();
  }, [runApkFlow, runAutoCheck]);

  const checkNow = useCallback(async (): Promise<UpdateCheckOutcome> => {
    if (phaseRef.current !== 'idle') return 'latest';
    setPhase('checking');
    const result = await checkForUpdate(true);
    let presented = false;
    if (result.outcome === 'ota' || result.outcome === 'apk') {
      const target = result.info;
      if (target && dismissedVersionCodeRef.current !== target.versionCode) {
        presentPrompt(target);
        presented = true;
      }
    }
    if (!presented) setPhase('idle');
    return result.outcome;
  }, [presentPrompt, setPhase]);

  const confirmUpdate = useCallback(() => {
    const target = infoRef.current;
    if (!target) return;
    if (target.updateType === 'ota') {
      setPhase('downloading');
      applyOtaUpdate().catch((e) => {
        console.warn('[update] OTA apply failed', e);
        setError(apkErrorFrom(e));
        setPhase('error');
      });
    } else {
      runApkFlow(target, null);
    }
  }, [runApkFlow, setPhase]);

  const dismiss = useCallback(() => {
    if (infoRef.current) dismissedVersionCodeRef.current = infoRef.current.versionCode;
    reset();
  }, [reset]);

  const openInstallPermissionSettings = useCallback(() => {
    openApkInstallSettings().catch(() => {});
  }, []);

  const value = useMemo<UpdateManagerContextValue>(
    () => ({
      phase,
      info,
      apkProgress,
      error,
      isChecking: phase === 'checking',
      runningVersionCode,
      checkNow,
      confirmUpdate,
      dismiss,
      retryUpdate: confirmUpdate,
      openInstallPermissionSettings,
    }),
    [phase, info, apkProgress, error, runningVersionCode, checkNow, confirmUpdate, openInstallPermissionSettings],
  );

  return (
    <UpdateManagerContext.Provider value={value}>
      {children}
      {phase === 'prompt' && info ? (
        <UpdateDialog info={info} onLater={dismiss} onUpdate={confirmUpdate} />
      ) : null}
      {phase === 'downloading' && info ? (
        <UpdateProgress info={info} apkProgress={apkProgress} />
      ) : null}
      <UpdatePermissionDialog
        visible={phase === 'permission'}
        onOpenSettings={openInstallPermissionSettings}
        onLater={dismiss}
      />
      <UpdateErrorDialog
        visible={phase === 'error'}
        error={error}
        onLater={dismiss}
        onRetry={confirmUpdate}
      />
    </UpdateManagerContext.Provider>
  );
}



