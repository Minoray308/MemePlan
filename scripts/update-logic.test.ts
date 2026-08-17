/**
 * Executable unit test for the pure update logic (semver comparison, APK
 * selection, SHA-256 parsing, GitHub URL trust).
 *
 * Run with Node 24+ (native TS type-stripping):
 *   node --experimental-strip-types scripts/update-logic.test.ts
 */
import {
  compareVersions,
  findApkAsset,
  hashForApkFromText,
  isGithubAssetUrl,
  stripLeadingV,
} from '../src/services/update/updateLogic';
import type { GitHubRelease, GitHubReleaseAsset } from '../src/services/update/updateTypes';

let failures = 0;
function assert(cond: boolean, label: string): void {
  if (cond) {
    console.log('  PASS  ' + label);
  } else {
    failures += 1;
    console.error('  FAIL  ' + label);
  }
}

function asset(name: string): GitHubReleaseAsset {
  return {
    name,
    browserDownloadUrl: `https://github.com/Minoray803/memeplan/releases/download/v1.2.3/${name}`,
    size: 100,
    contentType: 'application/vnd.android.package-archive',
  };
}

function release(assets: GitHubReleaseAsset[], tag = 'v1.2.3'): GitHubRelease {
  return { tagName: tag, name: 'r', body: null, htmlUrl: 'https://github.com/x/y/releases/tag/v1.2.3', publishedAt: null, assets };
}

// ---- Version comparison --------------------------------------------------
console.log('compareVersions:');
assert(compareVersions('1.2.3', '1.2.3') === 0, 'current == latest (equal)');
assert(compareVersions('1.2.0', '1.2.3') === -1, 'current < latest');
assert(compareVersions('1.2.4', '1.2.3') === 1, 'current > latest');
assert(compareVersions('1.2.3', '1.2.4') === -1, '1.2.3 < 1.2.4');
assert(compareVersions('1.9.0', '1.10.0') === -1, '1.9.0 < 1.10.0 (numeric, not string)');
assert(compareVersions('1.2.0', '1.1.9') === 1, '1.2.0 > 1.1.9');
assert(compareVersions('v1.2.3', '1.2.3') === 0, 'v-prefix ignored in compare');
assert(compareVersions('10.0.0', '9.9.9') === 1, '10.0.0 > 9.9.9');

console.log('stripLeadingV:');
assert(stripLeadingV('v1.2.3') === '1.2.3', 'v1.2.3 -> 1.2.3');
assert(stripLeadingV('1.2.3') === '1.2.3', '1.2.3 unchanged');
assert(stripLeadingV('V1.2.3') === '1.2.3', 'upper V removed');

// ---- APK selection -------------------------------------------------------
console.log('findApkAsset:');
assert(findApkAsset(release([])) === null, 'no APK -> null');
assert(
  findApkAsset(release([asset('memeplan-1.2.3-sources.zip'), asset('Source code.zip')])) === null,
  'source zips are ignored (no APK)',
);
assert(
  findApkAsset(release([asset('memeplan-1.2.3.apk')]))?.name === 'memeplan-1.2.3.apk',
  'single apk selected',
);
{
  const picked = findApkAsset(
    release([asset('memeplan-1.2.3-arm64-v8a.apk'), asset('memeplan-1.2.3-universal.apk'), asset('memeplan-1.2.3-armeabi-v7a.apk')]),
  );
  assert(picked?.name === 'memeplan-1.2.3-universal.apk', 'universal preferred over ABIs');
}
{
  const picked = findApkAsset(release([asset('memeplan-1.2.3-arm64-v8a.apk'), asset('memeplan-1.2.3-armeabi-v7a.apk')]));
  assert(picked?.name === 'memeplan-1.2.3-arm64-v8a.apk', 'arm64-v8a preferred over armeabi-v7a');
}
{
  const picked = findApkAsset(release([asset('memeplan-1.2.3-test.apk'), asset('memeplan-1.2.3.apk')]));
  assert(picked?.name === 'memeplan-1.2.3.apk', 'test/debug apk skipped');
}

// ---- GitHub URL trust ----------------------------------------------------
console.log('isGithubAssetUrl:');
assert(isGithubAssetUrl('https://github.com/a/b/releases/download/v1/a.apk') === true, 'github.com allowed');
assert(isGithubAssetUrl('https://objects.githubusercontent.com/x/y') === true, 'objects.githubusercontent.com allowed');
assert(isGithubAssetUrl('http://github.com/a/b/v1/a.apk') === false, 'http rejected');
assert(isGithubAssetUrl('https://evil.example.com/a.apk') === false, 'foreign host rejected');

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
