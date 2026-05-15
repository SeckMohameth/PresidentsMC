const appJson = require('./app.json');

module.exports = () => {
  const config = appJson.expo;

  return {
    ...config,
    android: {
      ...config.android,
      ...(process.env.GOOGLE_MAPS_ANDROID_API_KEY
        ? {
            config: {
              ...(config.android?.config || {}),
              googleMaps: {
                ...(config.android?.config?.googleMaps || {}),
                apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY,
              },
            },
          }
        : {}),
    },
  };
};
