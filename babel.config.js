module.exports = function (api) {
  api.cache(true);
  const plugins = [];
  if (
    process.env.EXPO_PUBLIC_STRIP_NATIVE !== '1' &&
    process.env.EXPO_PUBLIC_DIAGNOSTIC_B23 !== '1' &&
    process.env.EXPO_PUBLIC_DIAGNOSTIC_B25 !== '1' &&
    process.env.EXPO_PUBLIC_DIAGNOSTIC_B26 !== '1' &&
    process.env.EXPO_PUBLIC_DIAGNOSTIC_B28 !== '1' &&
    process.env.EXPO_PUBLIC_DIAGNOSTIC_B29 !== '1' &&
    process.env.EXPO_PUBLIC_DIAGNOSTIC_B30 !== '1' &&
    process.env.EXPO_PUBLIC_DIAGNOSTIC_B31 !== '1'
  ) {
    plugins.push('react-native-reanimated/plugin');
  }
  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};
