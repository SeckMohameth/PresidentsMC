const appJson = require('./app.json');

module.exports = () => {
  const config = appJson.expo;
  const androidMapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  const iosMapsKey = process.env.GOOGLE_MAPS_IOS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
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
