import type { ExpoConfig } from 'expo/config';

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'https://liftflow-api.onrender.com';

const config: ExpoConfig = {
  name: 'LiftFlow',
  slug: 'liftflow',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'liftflow',
  userInterfaceStyle: 'dark',
  ios: {
    icon: './assets/expo.icon',
    bundleIdentifier: 'com.liftflow.app',
    buildNumber: '1',
    infoPlist: {
      NSMicrophoneUsageDescription: 'LiftFlow uses the microphone for voice workout logging.',
      NSSpeechRecognitionUsageDescription: 'LiftFlow converts speech to workout sets.',
      NSPhotoLibraryUsageDescription: 'LiftFlow saves progress photos to track your transformation.',
    },
  },
  android: {
    package: 'com.liftflow.app',
    versionCode: 1,
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-speech-recognition',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#0A0A0B',
        android: {
          image: './assets/images/splash-icon.png',
          imageWidth: 76,
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
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
  owner: process.env.EXPO_OWNER,
};

export default config;
