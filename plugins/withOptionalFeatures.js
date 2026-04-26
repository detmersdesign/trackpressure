const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withOptionalFeatures(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const manifest = androidManifest.manifest;

    if (!manifest['uses-feature']) {
      manifest['uses-feature'] = [];
    }

    // Mark camera as optional
    manifest['uses-feature'] = manifest['uses-feature'].filter(
      (feature) =>
        feature.$['android:name'] !== 'android.hardware.camera' &&
        feature.$['android:name'] !== 'android.hardware.microphone'
    );

    manifest['uses-feature'].push(
      {
        $: {
          'android:name': 'android.hardware.camera',
          'android:required': 'false',
        },
      },
      {
        $: {
          'android:name': 'android.hardware.microphone',
          'android:required': 'false',
        },
      }
    );

    return config;
  });
};