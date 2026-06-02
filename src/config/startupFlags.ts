/** Build 31: B27 baseline + react-native-gesture-handler only. */
export const DIAGNOSTIC_B31 = process.env.EXPO_PUBLIC_DIAGNOSTIC_B31 === '1';

/** Build 30: B27 baseline + react-native-screens only. */
export const DIAGNOSTIC_B30 = process.env.EXPO_PUBLIC_DIAGNOSTIC_B30 === '1';

/** Build 29: B27 baseline + react-native-safe-area-context only. */
export const DIAGNOSTIC_B29 = process.env.EXPO_PUBLIC_DIAGNOSTIC_B29 === '1';

/** Build 28: B27 baseline + Expo Router navigation only. */
export const DIAGNOSTIC_B28 = process.env.EXPO_PUBLIC_DIAGNOSTIC_B28 === '1';

/** Build 26: plain App.tsx entry, zero config plugins, max native exclusions. */
export const DIAGNOSTIC_B26 = process.env.EXPO_PUBLIC_DIAGNOSTIC_B26 === '1';

/** Build 25: legacy architecture, no startup init, single diagnostic screen. */
export const DIAGNOSTIC_B25 = process.env.EXPO_PUBLIC_DIAGNOSTIC_B25 === '1';

/** Build 23 TurboModule crash diagnostic — blank screen, Sentry-first, old architecture. */
export const DIAGNOSTIC_B23 = process.env.EXPO_PUBLIC_DIAGNOSTIC_B23 === '1';

/** Expo SDK 54 infrastructure smoke test (TestFlight isolation). */
export const SMOKE_TEST = process.env.EXPO_PUBLIC_SMOKE_TEST === '1';

/** Build 18 diagnostic: strip optional native plugins from prebuild + Metro stubs. */
export const STRIP_NATIVE = process.env.EXPO_PUBLIC_STRIP_NATIVE === '1';

/** Build 17/18: splash + login only. */
export const MINIMAL_STARTUP =
  process.env.EXPO_PUBLIC_MINIMAL_STARTUP === '1' || STRIP_NATIVE;

/** Skip expo-router initial URL parsing. */
export const DEEP_LINKING_ENABLED =
  process.env.EXPO_PUBLIC_DISABLE_DEEP_LINKING !== '1' &&
  !STRIP_NATIVE &&
  !SMOKE_TEST &&
  !DIAGNOSTIC_B23 &&
  !DIAGNOSTIC_B25 &&
  !DIAGNOSTIC_B26 &&
  !DIAGNOSTIC_B28 &&
  !DIAGNOSTIC_B29 &&
  !DIAGNOSTIC_B30 &&
  !DIAGNOSTIC_B31;
