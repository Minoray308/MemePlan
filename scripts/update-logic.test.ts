/**
 * Executable unit test for the pure update logic (semver comparison, update
 * decision, server payload parsing, HTTP status mapping, SHA-256 parsing).
 *
 * Run with Node 24+ (native TS type-stripping):
 *   node --experimental-strip-types scripts/update-logic.test.ts
 *
 * The package.json "test:update-logic" script compiles this with tsc and runs
 * the resulting JS against the pure logic modules.
 */
import {
  compareVersions,
  decideUpdate,
  hashForApkFromText,
  isHttpsUrl,
  mapServerStatusToCode,
  parseServerUpdateInfoRaw,
  stripLeadingV,
} from '../src/services/update/updateLogic';

let failures = 0;
function assert(cond: boolean, label: string): void {
  if (cond) {
    console.log('  PASS  ' + label);
  } else {
    failures += 1;
    console.error('  FAIL  ' + label);
  }
}

// ---- Version comparison --------------------------------------------------
console.log('compareVersions:');
assert(compareVersions('1.0.0', '1.0.1') === -1, '1.0.0 < 1.0.1');
assert(compareVersions('1.0.1', '1.0.0') === 1, '1.0.1 > 1.0.0');
assert(compareVersions('1.0.0', '1.0.0') === 0, '1.0.0 == 1.0.0 (equal)');
assert(compareVersions('1.9.0', '1.10.0') === -1, '1.9.0 < 1.10.0 (numeric, not string)');
assert(compareVersions('10.0.0', '2.0.0') === 1, '10.0.0 > 2.0.0');
assert(compareVersions('v1.2.3', '1.2.3') === 0, 'v-prefix ignored in compare');
assert(compareVersions('1.2', '1.2.0') === 0, '1.2 == 1.2.0 (compatible)');

console.log('stripLeadingV:');
assert(stripLeadingV('v1.2.3') === '1.2.3', 'v1.2.3 -> 1.2.3');
assert(stripLeadingV('1.2.3') === '1.2.3', '1.2.3 unchanged');
assert(stripLeadingV('V1.2.3') === '1.2.3', 'upper V removed');

// ---- Update decision -----------------------------------------------------
console.log('decideUpdate:');
assert(
  decideUpdate({ currentVersion: '1.0.0', latestVersion: '2.0.0', minimumVersion: '1.5.0', otaEnabled: true, hasApk: true }).kind === 'force_apk',
  'current < minimum -> force_apk (forced update)',
);
assert(
  decideUpdate({ currentVersion: '1.0.0', latestVersion: '2.0.0', minimumVersion: '1.5.0', otaEnabled: true, hasApk: false }).kind === 'requires_apk_without_url',
  'current < minimum but no apk -> requires_apk_without_url',
);
assert(
  decideUpdate({ currentVersion: '1.0.0', latestVersion: '2.0.0', minimumVersion: '1.0.0', otaEnabled: false, hasApk: true }).kind === 'apk',
  'current < latest -> apk (large update wins)',
);
assert(
  decideUpdate({ currentVersion: '1.0.0', latestVersion: '2.0.0', minimumVersion: '1.0.0', otaEnabled: true, hasApk: false }).kind === 'ota',
  'current < latest, ota enabled, no apk -> ota (small update)',
);
assert(
  decideUpdate({ currentVersion: '2.0.0', latestVersion: '2.0.0', minimumVersion: '1.5.0', otaEnabled: true, hasApk: false }).kind === 'latest',
  'current == latest -> latest',
);
assert(
  decideUpdate({ currentVersion: '2.1.0', latestVersion: '2.0.0', minimumVersion: '1.5.0', otaEnabled: true, hasApk: true }).kind === 'latest',
  'current > latest -> latest',
);
assert(
  decideUpdate({ currentVersion: '1.0.0', latestVersion: '2.0.0', minimumVersion: '1.5.0', otaEnabled: false, hasApk: true }).kind === 'force_apk',
  'forced update ignores otaEnabled (apk required)',
);

// ---- HTTP status mapping (server failure path) ---------------------------
console.log('mapServerStatusToCode:');
assert(mapServerStatusToCode(404) === 'no_release', '404 -> no_release');
assert(mapServerStatusToCode(500) === 'http', '500 -> http');
assert(mapServerStatusToCode(403) === 'http', '403 -> http (no rate-limit-specific code)');

// ---- HTTPS URL trust -----------------------------------------------------
console.log('isHttpsUrl:');
assert(isHttpsUrl('https://download.example.com/android/app-1.2.3.apk') === true, 'https allowed');
assert(isHttpsUrl('http://example.com/a.apk') === false, 'http rejected');
assert(isHttpsUrl('not-a-url') === false, 'invalid url rejected');

// ---- Server payload parsing (server JSON error path) ---------------------
console.log('parseServerUpdateInfoRaw:');
assert(
  parseServerUpdateInfoRaw({ platform: 'android', latestVersion: '2.0.0', minimumVersion: '1.5.0', apkUrl: 'https://x/a.apk' }).latestVersion === '2.0.0',
  'valid payload parses',
);
assert(
  parseServerUpdateInfoRaw({ platform: 'android', latestVersion: '2.0.0', minimumVersion: '1.5.0', ota: { enabled: true } }).ota?.enabled === true,
  'ota metadata parsed',
);
{
  let threw = false;
  try { parseServerUpdateInfoRaw({ platform: 'ios', latestVersion: '2.0.0', minimumVersion: '1.5.0' }); } catch { threw = true; }
  assert(threw, 'invalid platform throws (server JSON error)');
}
{
  let threw = false;
  try { parseServerUpdateInfoRaw({ platform: 'android' }); } catch { threw = true; }
  assert(threw, 'missing version fields throws (server JSON error)');
}
{
  let threw = false;
  try { parseServerUpdateInfoRaw(null); } catch { threw = true; }
  assert(threw, 'null payload throws (server JSON error)');
}

// ---- SHA-256 parsing -----------------------------------------------------
console.log('hashForApkFromText:');
const sha = 'a'.repeat(64);
assert(hashForApkFromText(`${sha}  memeplan-1.2.3.apk`, 'memeplan-1.2.3.apk') === sha, 'SHA256SUMS line');
assert(hashForApkFromText(`${sha}  memeplan-1.2.3.apk\nother  x`, 'memeplan-1.2.3.apk') === sha, 'SHA256SUMS multi-file');
assert(hashForApkFromText(`memeplan-1.2.3.apk: ${sha}`, 'memeplan-1.2.3.apk') === sha, 'filename: hash');
assert(hashForApkFromText(`no hash here`, 'memeplan-1.2.3.apk') === null, 'no hash -> null');

console.log('');
if (failures > 0) {
  console.error(`${failures} test(s) FAILED`);
  ((globalThis as unknown) as { process?: { exit(c: number): void } }).process?.exit(1);
} else {
  console.log('All update-logic tests passed.');
}