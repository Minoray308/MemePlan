import type { ServerUpdateInfo, UpdateCheckErrorCode } from './updateTypes';

/**
 * Pure, dependency-free update logic (no react-native / native module), so it
 * can be unit-tested in isolation (see scripts/update-logic.test.ts).
 */

/** Parses "v1.2.3" / "1.2.3" / "1.2" into [major, minor, patch]. */
function parseVersion(v: string): number[] {
  const cleaned = String(v).trim().replace(/^v/i, '');
  const m = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(cleaned);
  if (!m) return [0, 0, 0];
  return [
    parseInt(m[1] ?? '0', 10),
    parseInt(m[2] ?? '0', 10),
    parseInt(m[3] ?? '0', 10),
  ];
}

/** Removes a leading "v" from a tag, e.g. "v1.2.3" -> "1.2.3". */
export function stripLeadingV(tag: string): string {
  return String(tag || '').trim().replace(/^v/i, '');
}

/**
 * Numeric semver comparison (not string comparison). Returns:
 *   1 when a > b, -1 when a < b, 0 when equal.
 * E.g. compareVersions('1.10.0', '1.9.0') === 1 and
 *      compareVersions('1.2.0', '1.1.9') === 1.
 */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

/** Extracts a 64-hex SHA-256 that names `apkName` from standard checksum text. */
export function hashForApkFromText(text: string, apkName: string): string | null {
  const lowerName = apkName.toLowerCase();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    // "hash  filename" (GNU / SHA256SUMS format, optionally *escaped)
    const hashFirst = /^([0-9a-fA-F]{64})\s+(\S+)$/.exec(line);
    if (hashFirst) {
      const file = hashFirst[2].replace(/^\*/, '').toLowerCase();
      if (file === lowerName || file.endsWith(`/${lowerName}`)) {
        return hashFirst[1].toLowerCase();
      }
      continue;
    }
    // "filename: hash" / "filename = hash"
    const nameFirst = /^(\S+)[:=]\s*([0-9a-fA-F]{64})$/.exec(line);
    if (nameFirst) {
      const file = nameFirst[1].replace(/^\*/, '').toLowerCase();
      if (file === lowerName || file.endsWith(`/${lowerName}`)) {
        return nameFirst[2].toLowerCase();
      }
    }
  }
  return null;
}

/** Result of the pure version-decision logic (no I/O). */
export type UpdateDecision =
  | { kind: 'latest' }
  /** current < minimumVersion and an APK is available -> forced install. */
  | { kind: 'force_apk' }
  /** normal newer build delivered as a JS (OTA) update. */
  | { kind: 'ota' }
  /** normal newer build delivered as an APK. */
  | { kind: 'apk' }
  /** an update is required/available but there is no APK URL to install. */
  | { kind: 'requires_apk_without_url' };

/**
 * Decides what the app should do given the server version metadata. Pure and
 * side-effect free so it can be unit-tested in isolation.
 *
 * Rules:
 *  - current < minimumVersion -> forced update (APK required).
 *  - otherwise, current < latestVersion -> OTA when OTA is enabled and no new
 *    APK is published, else APK (large update wins when both exist).
 *  - otherwise -> latest.
 */
export function decideUpdate(params: {
  currentVersion: string;
  latestVersion: string;
  minimumVersion: string;
  otaEnabled: boolean;
  hasApk: boolean;
}): UpdateDecision {
  const { currentVersion, latestVersion, minimumVersion, otaEnabled, hasApk } = params;

  if (compareVersions(currentVersion, minimumVersion) < 0) {
    return hasApk ? { kind: 'force_apk' } : { kind: 'requires_apk_without_url' };
  }

  if (compareVersions(latestVersion, currentVersion) > 0) {
    if (otaEnabled && !hasApk) return { kind: 'ota' };
    return hasApk ? { kind: 'apk' } : { kind: 'requires_apk_without_url' };
  }

  return { kind: 'latest' };
}

/** Maps a non-OK HTTP status to a stable update-check error code. */
export function mapServerStatusToCode(status: number): UpdateCheckErrorCode {
  if (status === 404) return 'no_release';
  return 'http';
}

/** True when `url` is an HTTPS URL (used to gate APK downloads). */
export function isHttpsUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validates a raw JSON payload from the Cloudflare version API into a typed
 * ServerUpdateInfo. Pure; throws UpdateCheckError('parse') on bad payloads so
 * tests can verify the "server JSON error" path.
 */
export function parseServerUpdateInfoRaw(raw: unknown): ServerUpdateInfo {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('invalid payload');
  }
  const r = raw as Record<string, unknown>;
  if (r.platform !== 'android') throw new Error('invalid platform');
  if (typeof r.latestVersion !== 'string' || typeof r.minimumVersion !== 'string') {
    throw new Error('missing version fields');
  }
  const otaRaw = r.ota;
  return {
    platform: 'android',
    latestVersion: r.latestVersion,
    minimumVersion: r.minimumVersion,
    forceUpdate: r.forceUpdate === true,
    apkUrl:
      typeof r.apkUrl === 'string' && r.apkUrl.length > 0 ? r.apkUrl : undefined,
    apkName:
      typeof r.apkName === 'string' && r.apkName.length > 0 ? r.apkName : undefined,
    sha256:
      typeof r.sha256 === 'string' && /^[0-9a-fA-F]{64}$/.test(r.sha256)
        ? r.sha256.toLowerCase()
        : undefined,
    releaseNotes: Array.isArray(r.releaseNotes)
      ? r.releaseNotes.filter((x): x is string => typeof x === 'string')
      : undefined,
    publishedAt:
      typeof r.publishedAt === 'string' && r.publishedAt.length > 0
        ? r.publishedAt
        : undefined,
    ota:
      typeof otaRaw === 'object' && otaRaw !== null
        ? {
            enabled: (otaRaw as Record<string, unknown>).enabled === true,
            runtimeVersion:
              typeof (otaRaw as Record<string, unknown>).runtimeVersion === 'string'
                ? ((otaRaw as Record<string, unknown>).runtimeVersion as string)
                : undefined,
          }
        : undefined,
  };
}