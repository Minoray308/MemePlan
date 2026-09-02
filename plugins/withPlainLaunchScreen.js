const { withAndroidStyles } = require('expo/config-plugins');

/** Keep Android's launch transition plain, including the Android 12+ icon. */
module.exports = function withPlainLaunchScreen(config) {
  return withAndroidStyles(config, (config) => {
    const styles = config.modResults.resources.style ??= [];
    let splash = styles.find(style => style.$.name === 'Theme.App.SplashScreen');
    if (!splash) {
      splash = { $: { name: 'Theme.App.SplashScreen', parent: 'AppTheme' }, item: [] };
      styles.push(splash);
    }
    const values = {
      'android:windowBackground': '@color/splashscreen_background',
      'android:windowSplashScreenBackground': '@color/splashscreen_background',
      'android:windowSplashScreenAnimatedIcon': '@android:color/transparent',
      'android:windowSplashScreenIconBackgroundColor': '@android:color/transparent',
    };
    splash.item = (splash.item ?? []).filter(item => !(item.$.name in values));
    for (const [name, value] of Object.entries(values)) {
      splash.item.push({ $: { name }, _: value });
    }
    return config;
  });
};
