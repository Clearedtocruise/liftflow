/** B27 baseline — all optional native modules stripped for TestFlight isolation. */
const B27_BASELINE_EXCLUDES = [
  '@kingstinct/react-native-healthkit',
  'react-native-nitro-modules',
  'react-native-purchases',
  'react-native-watch-connectivity',
  'expo-speech-recognition',
  'expo-dev-client',
  'expo-dev-launcher',
  'expo-dev-menu',
  'expo-dev-menu-interface',
  'react-native-reanimated',
  'react-native-worklets',
  '@sentry/react-native',
  'react-native-svg',
  'expo-updates',
  'expo-updates-interface',
  'react-native-gesture-handler',
  'react-native-screens',
  'react-native-safe-area-context',
  '@react-native-async-storage/async-storage',
  'expo-router',
  'expo-linking',
  'expo-av',
  'expo-notifications',
  'expo-location',
  'expo-image',
  'expo-image-picker',
  'expo-linear-gradient',
  'expo-speech',
  'expo-secure-store',
  'expo-sharing',
  'expo-web-browser',
  'expo-system-ui',
  'expo-symbols',
  'expo-file-system',
  'expo-font',
  'expo-device',
  'expo-eas-client',
  'expo-application',
  'expo-structured-headers',
  'expo-manifests',
  'expo-json-utils',
  'expo-image-loader',
];

const NAVIGATION_PACKAGES = [
  'expo-router',
  'react-native-gesture-handler',
  'react-native-screens',
  'react-native-safe-area-context',
  'expo-linking',
];

/** @param {'b26' | 'b28' | 'b29' | 'b30' | 'b31'} profile */
function getDiagnosticExcludes(profile) {
  switch (profile) {
    case 'b28':
      return B27_BASELINE_EXCLUDES.filter((name) => !NAVIGATION_PACKAGES.includes(name));
    case 'b29':
      return B27_BASELINE_EXCLUDES.filter((name) => name !== 'react-native-safe-area-context');
    case 'b30':
      return B27_BASELINE_EXCLUDES.filter((name) => name !== 'react-native-screens');
    case 'b31':
      return B27_BASELINE_EXCLUDES.filter((name) => name !== 'react-native-gesture-handler');
    case 'b26':
    default:
      return B27_BASELINE_EXCLUDES;
  }
}

module.exports = { B27_BASELINE_EXCLUDES, getDiagnosticExcludes };
