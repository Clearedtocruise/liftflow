module.exports = function (api) {
  api.cache(true);
  const plugins = [];
  if (process.env.EXPO_PUBLIC_STRIP_NATIVE !== '1') {
    plugins.push('react-native-reanimated/plugin');
  }
  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};
