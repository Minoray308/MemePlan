import { APK_NAME_PRIORITY } from '../../constants/update';
import type { GitHubRelease, GitHubReleaseAsset } from './updateTypes';

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

/**
 * Only trust APK URLs that GitHub itself hosts: browser_download_url is
 * `https://github.com/<owner>/<repo>/releases/download/<tag>/<name>` (which
 * redirects to objects.githubusercontent.com for the bytes). Anything else in
 * the release JSON is ignored so the app never installs from an arbitrary
 * host. TLS is never disabled for these downloads.
 */
export function isGithubAssetUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    return (
      host === 'github.com' ||
      host.endsWith('.github.com') ||
      host === 'githubusercontent.com' ||
      host.endsWith('.githubusercontent.com') ||
      host === 'objects.githubusercontent.com'
    );
  } catch {
    return false;
  }
}

/** Lower rank = more preferred (see APK_NAME_PRIORITY). Infinity = not an APK. */
export function rankApk(name: string): number {
  const lower = name.toLowerCase();
  if (!lower.endsWith('.apk')) return Infinity;
  // Skip obvious non-app / development artifacts even if they end in .apk.
  if (/test|debug|source|sources|unsigned|unaligned|proguard/.test(lower)) return Infinity;
  for (let i = 0; i < APK_NAME_PRIORITY.length; i += 1) {
    if (lower.includes(APK_NAME_PRIORITY[i].toLowerCase())) return i;
  }
  // Generic APK with no known ABI marker — accepted after all known ABIs.
  return APK_NAME_PRIORITY.length + 1;
}

/**
 * Picks the APK to install from a release's assets. Only `.apk` files are
 * considered; source zips/tar.gz are never candidates. Selections are ranked
 * by APK_NAME_PRIORITY (universal first, then native ABIs this project
 * builds); ties are broken alphabetically by asset name.
 */
export function findApkAsset(release: GitHubRelease): GitHubReleaseAsset | null {
  const candidates = release.assets
    .filter((a) => isGithubAssetUrl(a.browserDownloadUrl) && a.name.length > 0)
    .map((a) => ({ asset: a, rank: rankApk(a.name) }))
    .filter((c) => c.rank !== Infinity)
    .sort((x, y) => x.rank - y.rank || x.asset.name.localeCompare(y.asset.name));
  return candidates.length > 0 ? candidates[0].asset : null;
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


