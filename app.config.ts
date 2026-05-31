import type { ExpoConfig } from 'expo/config';

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'https://liftflow-api.onrender.com';

const config: ExpoConfig = {
  name: 'LiftFlow',
  slug: 'liftflow',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/branding/liftflow-icon-1024.png',
  scheme: 'liftflow',
  userInterfaceStyle: 'dark',
  ios: {
    icon: './assets/branding/liftflow-icon-1024.png',
    bundleIdentifier: 'com.liftflow.app',
    buildNumber: '1',
    infoPlist: {
      NSMicrophoneUsageDescription: 'LiftFlow uses the microphone for voice workout logging and AI coaching.',
      NSSpeechRecognitionUsageDescription: 'LiftFlow converts speech to workout sets and coaching questions.',
      NSPhotoLibraryUsageDescription: 'LiftFlow saves progress photos to track your transformation.',
      NSHealthShareUsageDescription: 'LiftFlow reads steps, weight, heart rate, and workouts from Apple Health to personalize coaching.',
      NSHealthUpdateUsageDescription: 'LiftFlow may write workout data to Apple Health when you log sessions.',
      NSLocationWhenInUseUsageDescription:
        'LiftFlow uses your location to detect when you arrive at a saved gym and suggest starting a workout.',
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.liftflow.app',
    versionCode: 1,
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
      backgroundColor: '#080B10',
      foregroundImage: './assets/branding/liftflow-icon-1024.png',
      monochromeImage: './assets/branding/liftflow-icon-1024.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'static',
    favicon: './assets/branding/liftflow-icon-256.png',
  },
  plugins: [
    'expo-router',
    'expo-dev-client',
    'expo-speech-recognition',
    [
      '@kingstinct/react-native-healthkit',
      {
        NSHealthShareUsageDescription: 'LiftFlow reads steps, weight, heart rate, and workouts from Apple Health.',
        NSHealthUpdateUsageDescription: 'LiftFlow writes workout data to Apple Health when you log sessions.',
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'LiftFlow uses your location to detect when you arrive at a saved gym and suggest starting a workout.',
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/branding/liftflow-icon-256.png',
        color: '#1F6BFF',
        sounds: [],
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#080B10',
        android: {
          image: './assets/branding/liftflow-icon-512.png',
          imageWidth: 162,
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
