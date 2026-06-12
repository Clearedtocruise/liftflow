import type { ExpoConfig } from 'expo/config';

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'https://liftflow-api.onrender.com';

function parseSentryDsn(dsn: string | undefined): { orgId: string; projectId: string } | null {
  if (!dsn) return null;
  const match = dsn.match(/@o(\d+)\.ingest(?:\.[a-z]+)?\.sentry\.io\/(\d+)/);
  return match ? { orgId: match[1], projectId: match[2] } : null;
}

const sentryFromDsn = parseSentryDsn(process.env.EXPO_PUBLIC_SENTRY_DSN);
const sentryOrganization = process.env.SENTRY_ORG ?? sentryFromDsn?.orgId ?? '';
const sentryProject = process.env.SENTRY_PROJECT ?? sentryFromDsn?.projectId ?? '';

const config: ExpoConfig = {
  name: 'ONE MORE',
  slug: 'liftflow',
  version: '1.0.0',
  runtimeVersion: {
    policy: 'appVersion',
  },
  updates: {
    url: 'https://u.expo.dev/62d95ef4-66d9-4638-8e66-93d27e1fb48d',
    // Disabled until first stable TestFlight launch — expo-updates ErrorRecovery
    // intercepts RN fatal handlers and re-raises NSException (SIGABRT) on failed recovery.
    enabled: false,
  },
  orientation: 'portrait',
  icon: './assets/branding/one-more-icon-1024.png',
  scheme: 'liftflow',
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
  plugins: [
    'expo-router',
    'expo-dev-client',
    [
      '@sentry/react-native/expo',
      {
        url: 'https://sentry.io/',
        organization: sentryOrganization,
        project: sentryProject,
      },
    ],
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
  ],
  experiments: {
    typedRoutes: true,
  },
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
