const appJson = require('./app.json');

module.exports = ({ config: baseConfig }) => {
  const staticConfig = appJson.expo;
  const config = {
    ...baseConfig,
    ...staticConfig,
    extra: {
      ...(baseConfig.extra || {}),
      ...(staticConfig.extra || {}),
    },
    ios: {
      ...(baseConfig.ios || {}),
      ...(staticConfig.ios || {}),
    },
    android: {
      ...(baseConfig.android || {}),
      ...(staticConfig.android || {}),
    },
  };
  const androidMapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  const iosMapsKey = process.env.GOOGLE_MAPS_IOS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID || process.env.EAS_PROJECT_ID;
  const plugins = [...(config.plugins || [])];

  if (androidMapsKey || iosMapsKey) {
    plugins.push([
      'react-native-maps',
      {
        ...(androidMapsKey ? { androidGoogleMapsApiKey: androidMapsKey } : {}),
        ...(iosMapsKey ? { iosGoogleMapsApiKey: iosMapsKey } : {}),
      },
    ]);
  }

  return {
    ...config,
    extra: {
      ...(config.extra || {}),
      ...(easProjectId
        ? {
            eas: {
              ...(config.extra?.eas || {}),
              projectId: easProjectId,
            },
          }
        : {}),
    },
    plugins,
    ios: {
      ...config.ios,
      ...(iosMapsKey
        ? {
            config: {
              ...(config.ios?.config || {}),
              googleMapsApiKey: iosMapsKey,
            },
          }
        : {}),
    },
    android: {
      ...config.android,
      ...(androidMapsKey
        ? {
            config: {
              ...(config.android?.config || {}),
              googleMaps: {
                ...(config.android?.config?.googleMaps || {}),
                apiKey: androidMapsKey,
              },
            },
          }
        : {}),
    },
  };
};
