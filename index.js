if (
  process.env.EXPO_PUBLIC_DIAGNOSTIC_B26 === '1' ||
  process.env.EXPO_PUBLIC_DIAGNOSTIC_B29 === '1' ||
  process.env.EXPO_PUBLIC_DIAGNOSTIC_B30 === '1' ||
  process.env.EXPO_PUBLIC_DIAGNOSTIC_B31 === '1'
) {
  const { registerRootComponent } = require('expo');
  const App =
    process.env.EXPO_PUBLIC_DIAGNOSTIC_B29 === '1'
      ? require('./App.diagnostic.b29').default
      : process.env.EXPO_PUBLIC_DIAGNOSTIC_B30 === '1'
        ? require('./App.diagnostic.b30').default
        : process.env.EXPO_PUBLIC_DIAGNOSTIC_B31 === '1'
          ? require('./App.diagnostic.b31').default
          : require('./App.diagnostic').default;
  registerRootComponent(App);
} else {
  require('react-native-gesture-handler');
  require('expo-router/entry');
}
