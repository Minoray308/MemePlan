// @ts-nocheck
/**
 * Config plugin for the quick-send floating window
 * (modules/sticker-overlay).
 *
 * Adds the SYSTEM_ALERT_WINDOW permission that a system overlay requires.
 */
const { withAndroidManifest } = require('expo/config-plugins');

const PERMISSION = 'android.permission.SYSTEM_ALERT_WINDOW';

module.exports = function withStickerOverlay(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const usesPermissions = manifest.manifest['uses-permission'] || [];
    const alreadyDeclared = usesPermissions.some(
      (item) => item.$ && item.$['android:name'] === PERMISSION,
    );
    if (!alreadyDeclared) {
      usesPermissions.push({ $: { 'android:name': PERMISSION } });
    }
    manifest.manifest['uses-permission'] = usesPermissions;
    return config;
  });
};
