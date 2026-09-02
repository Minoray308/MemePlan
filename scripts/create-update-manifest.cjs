const { readFileSync } = require('node:fs');
const { basename } = require('node:path');
const { createHash } = require('node:crypto');

function createReleaseManifest({ version, repository, apkPath, notesPath, publishedAt = new Date().toISOString() }) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid release version');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Invalid GitHub repository');
  const apkName = basename(apkPath);
  if (!apkName.endsWith('.apk')) throw new Error('Expected an APK file');
  const releaseUrl = 'https://github.com/' + repository + '/releases/tag/v' + version;
  return {
    platform: 'android', latestVersion: version, minimumVersion: '0.0.0', forceUpdate: false,
    apkName,
    apkUrl: 'https://github.com/' + repository + '/releases/download/v' + version + '/' + encodeURIComponent(apkName),
    sha256: createHash('sha256').update(readFileSync(apkPath)).digest('hex'),
    releaseNotes: [readFileSync(notesPath, 'utf8').trim()],
    publishedAt, releaseUrl,
  };
}

if (require.main === module) {
  const [version, apkPath, notesPath] = process.argv.slice(2);
  const manifest = createReleaseManifest({version, apkPath, notesPath, repository: process.env.GITHUB_REPOSITORY});
  process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');
}
module.exports = { createReleaseManifest };
