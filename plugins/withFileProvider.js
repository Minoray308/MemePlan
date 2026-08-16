// @ts-nocheck
/**
 * Config plugin that enables in-app APK installation.
 *
 * Adds a FileProvider (androidx.core.content.FileProvider) so the app can hand
 * the downloaded APK to the system package installer via a content:// URI,
 * plus the REQUEST_INSTALL_PACKAGES permission.
 */
const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

module.exports = function withFileProvider(config) {
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const application = manifest.manifest.application?.[0];
    if (!application) return config;

    // REQUEST_INSTALL_PACKAGES permission.
    const usesPermissions = manifest.manifest['uses-permission'] || [];
    if (!usesPermissions.some((p) => p.$?.['android:name'] === 'android.permission.REQUEST_INSTALL_PACKAGES')) {
      usesPermissions.push({ $: { 'android:name': 'android.permission.REQUEST_INSTALL_PACKAGES' } });
    }
    manifest.manifest['uses-permission'] = usesPermissions;

    // FileProvider.
    const providers = application.provider || [];
    const authority = '${applicationId}.fileprovider';
    if (!providers.some((p) => p.$?.['android:authorities'] === authority)) {
      providers.push({
        $: {
          'android:name': 'androidx.core.content.FileProvider',
          'android:authorities': authority,
          'android:exported': 'false',
          'android:grantUriPermissions': 'true',
        },
        'meta-data': [
          {
            $: {
              'android:name': 'android.support.FILE_PROVIDER_PATHS',
              'android:resource': '@xml/file_paths',
            },
          },
        ],
      });
      application.provider = providers;
    }
    return config;
  });

  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const resXml = path.join(config.modRequest.platformProjectRoot, 'app/src/main/res/xml');
      fs.mkdirSync(resXml, { recursive: true });
      const content =
        '<?xml version="1.0" encoding="utf-8"?>\n' +
        '<paths>\n' +
        '  <cache-path name="cache" path="." />\n' +
        '  <files-path name="files" path="." />\n' +
        '</paths>\n';
      fs.writeFileSync(path.join(resXml, 'file_paths.xml'), content);
      return config;
    },
  ]);

  return config;
};
