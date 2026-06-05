/** Expo SDK 54 infrastructure smoke test (TestFlight isolation). */
export const SMOKE_TEST = process.env.EXPO_PUBLIC_SMOKE_TEST === '1';

/** Build 18 diagnostic: strip optional native plugins from prebuild + Metro stubs. */
export const STRIP_NATIVE = process.env.EXPO_PUBLIC_STRIP_NATIVE === '1';

/** Build 17/18: splash + login only. */
export const MINIMAL_STARTUP =
  process.env.EXPO_PUBLIC_MINIMAL_STARTUP === '1' || STRIP_NATIVE;

/** Skip expo-router initial URL parsing. */
export const DEEP_LINKING_ENABLED =
  process.env.EXPO_PUBLIC_DISABLE_DEEP_LINKING !== '1' && !STRIP_NATIVE && !SMOKE_TEST;
