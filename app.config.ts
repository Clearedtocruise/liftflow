import type { ExpoConfig } from 'expo/config';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDiagnosticExcludes } = require('./diagnostic-autolinking.config.js') as {
  getDiagnosticExcludes: (profile: 'b26' | 'b28' | 'b29' | 'b30' | 'b31') => string[];
};

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'https://liftflow-api.onrender.com';

function parseSentryDsn(dsn: string | undefined): { orgId: string; projectId: string } | null {
  if (!dsn) return null;
  const match = dsn.match(/@o(\d+)\.ingest(?:\.[a-z]+)?\.sentry\.io\/(\d+)/);
  return match ? { orgId: match[1], projectId: match[2] } : null;
}

const sentryFromDsn = parseSentryDsn(process.env.EXPO_PUBLIC_SENTRY_DSN);
const sentryOrganization = process.env.SENTRY_ORG ?? sentryFromDsn?.orgId ?? '';
const sentryProject = process.env.SENTRY_PROJECT ?? sentryFromDsn?.projectId ?? '';

const disableDeepLinking = process.env.EXPO_PUBLIC_DISABLE_DEEP_LINKING === '1';
const stripNative = process.env.EXPO_PUBLIC_STRIP_NATIVE === '1';
const smokeTest = process.env.EXPO_PUBLIC_SMOKE_TEST === '1';
const diagnosticB23 = process.env.EXPO_PUBLIC_DIAGNOSTIC_B23 === '1';
const diagnosticB25 = process.env.EXPO_PUBLIC_DIAGNOSTIC_B25 === '1';
const diagnosticB26 = process.env.EXPO_PUBLIC_DIAGNOSTIC_B26 === '1';
const diagnosticB28 = process.env.EXPO_PUBLIC_DIAGNOSTIC_B28 === '1';
const diagnosticB29 = process.env.EXPO_PUBLIC_DIAGNOSTIC_B29 === '1';
const diagnosticB30 = process.env.EXPO_PUBLIC_DIAGNOSTIC_B30 === '1';
const diagnosticB31 = process.env.EXPO_PUBLIC_DIAGNOSTIC_B31 === '1';
const leanNativeBuild =
  stripNative || smokeTest || diagnosticB23 || diagnosticB25 || diagnosticB26 || diagnosticB28 || diagnosticB29 || diagnosticB30 || diagnosticB31;
const legacyDiagnosticBuild = diagnosticB25 || diagnosticB26 || diagnosticB28 || diagnosticB29 || diagnosticB30 || diagnosticB31;
const bareDiagnosticBuild = diagnosticB26 || diagnosticB28 || diagnosticB29 || diagnosticB30 || diagnosticB31;

function diagnosticAutolinkingProfile(): 'b26' | 'b28' | 'b29' | 'b30' | 'b31' | null {
  if (diagnosticB31) return 'b31';
  if (diagnosticB29) return 'b29';
  if (diagnosticB30) return 'b30';
  if (diagnosticB28) return 'b28';
  if (diagnosticB26) return 'b26';
  return null;
}

const diagnosticAutolinking = diagnosticAutolinkingProfile();

const splashPlugin: ExpoConfig['plugins'] = [
  [
    'expo-splash-screen',
    {
      backgroundColor: '#000000',
      image: './assets/branding/one-more-splash-full-512.png',
      imageWidth: 200,
      android: {
        image: './assets/branding/one-more-splash-full-512.png',
        imageWidth: 200,
      },
    },
  ],
];

const sentryPlugin: ExpoConfig['plugins'] = [
  [
    '@sentry/react-native/expo',
    {
      url: 'https://sentry.io/',
      organization: sentryOrganization,
      project: sentryProject,
    },
  ],
];

const b25Plugins: ExpoConfig['plugins'] = ['expo-router'];

const diagnosticPlugins: ExpoConfig['plugins'] = ['expo-router', ...sentryPlugin, ...splashPlugin];

const optionalPlugins: ExpoConfig['plugins'] = [
  'expo-dev-client',
  ...sentryPlugin,
  'expo-speech-recognition',
  [
    '@kingstinct/react-native-healthkit',
    {
      NSHealthShareUsageDescription: 'ONE MORE reads steps, weight, heart rate, and workouts from Apple Health.',
      NSHealthUpdateUsageDescription: 'ONE MORE writes workout data to Apple Health when you log sessions.',
    },
  ],
  [
    'expo-location',
    {
      locationWhenInUsePermission:
        'ONE MORE uses your location to detect when you arrive at a saved gym and suggest starting a workout.',
    },
  ],
  [
    'expo-notifications',
    {
      icon: './assets/branding/one-more-icon-256.png',
      color: '#0E90FF',
      sounds: [],
    },
  ],
];

const config: ExpoConfig = {
  name: diagnosticB31
    ? 'LiftFlow Diagnostic B31'
    : diagnosticB30
      ? 'LiftFlow Diagnostic B30'
      : diagnosticB29
      ? 'LiftFlow Diagnostic B29'
      : diagnosticB28
        ? 'LiftFlow Diagnostic B28'
        : diagnosticB26
          ? 'LiftFlow Diagnostic B26'
          : diagnosticB25
            ? 'LiftFlow Diagnostic B25'
            : diagnosticB23
              ? 'LiftFlow Diagnostic B23'
              : smokeTest
                ? 'LiftFlow Smoke Test'
                : 'ONE MORE',
  slug: 'liftflow',
  version: '1.0.0',
  ...(legacyDiagnosticBuild ? { newArchEnabled: false } : {}),
  ...(diagnosticAutolinking
    ? { autolinking: { exclude: getDiagnosticExcludes(diagnosticAutolinking) } }
    : {}),
  ...(bareDiagnosticBuild
    ? {}
    : {
        runtimeVersion: {
          policy: 'appVersion',
        },
        updates: {
          url: 'https://u.expo.dev/62d95ef4-66d9-4638-8e66-93d27e1fb48d',
          // Disabled until first stable TestFlight launch — expo-updates ErrorRecovery
          // intercepts RN fatal handlers and re-raises NSException (SIGABRT) on failed recovery.
          enabled: false,
        },
      }),
  orientation: 'portrait',
  icon: './assets/branding/one-more-icon-1024.png',
  ...(disableDeepLinking ||
  smokeTest ||
  diagnosticB23 ||
  diagnosticB26 ||
  diagnosticB29 ||
  diagnosticB30 ||
  diagnosticB31
    ? {}
    : { scheme: 'liftflow' }),
  userInterfaceStyle: 'dark',
  ios: {
    icon: './assets/branding/one-more-icon-1024.png',
    bundleIdentifier: 'com.liftflow.app',
    buildNumber: '13',
    infoPlist: {
      NSMicrophoneUsageDescription: 'ONE MORE uses the microphone for voice workout logging and AI coaching.',
      NSSpeechRecognitionUsageDescription: 'ONE MORE converts speech to workout sets and coaching questions.',
      NSPhotoLibraryUsageDescription: 'ONE MORE saves progress photos to track your transformation.',
      NSHealthShareUsageDescription: 'ONE MORE reads steps, weight, heart rate, and workouts from Apple Health to personalize coaching.',
      NSHealthUpdateUsageDescription: 'ONE MORE may write workout data to Apple Health when you log sessions.',
      NSLocationWhenInUseUsageDescription:
        'ONE MORE uses your location to detect when you arrive at a saved gym and suggest starting a workout.',
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.liftflow.app',
    versionCode: 13,
    permissions: [
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.health.READ_STEPS',
      'android.permission.health.READ_WEIGHT',
      'android.permission.health.READ_HEART_RATE',
      'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
      'android.permission.health.READ_DISTANCE',
      'android.permission.health.READ_EXERCISE',
    ],
    adaptiveIcon: {
      backgroundColor: '#000000',
      foregroundImage: './assets/branding/one-more-icon-1024.png',
      monochromeImage: './assets/branding/one-more-icon-1024.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'static',
    favicon: './assets/branding/one-more-icon-256.png',
  },
  plugins: diagnosticB26 || diagnosticB29 || diagnosticB30 || diagnosticB31
    ? []
    : diagnosticB28
      ? ['expo-router']
      : diagnosticB25
        ? b25Plugins
        : diagnosticB23
          ? diagnosticPlugins
          : leanNativeBuild
            ? ['expo-router', ...splashPlugin]
            : ['expo-router', ...optionalPlugins, ...splashPlugin],
  experiments:
    diagnosticB23 || diagnosticB25 || diagnosticB26 || diagnosticB28 || diagnosticB29 || diagnosticB30 || diagnosticB31
      ? {}
      : { typedRoutes: true },
  extra: {
    apiUrl,
    eas: {
      projectId: '62d95ef4-66d9-4638-8e66-93d27e1fb48d',
    },
    supportUrl: 'https://liftflow-api.onrender.com/legal/support',
    privacyPolicyUrl: 'https://liftflow-api.onrender.com/legal/privacy',
    termsUrl: 'https://liftflow-api.onrender.com/legal/terms',
    subscriptionTermsUrl: 'https://liftflow-api.onrender.com/legal/subscription-terms',
  },
  owner: 'liftflow1',
};

export default config;
