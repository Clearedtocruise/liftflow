const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const stripNative = process.env.EXPO_PUBLIC_STRIP_NATIVE === '1';
const smokeTest = process.env.EXPO_PUBLIC_SMOKE_TEST === '1';

const config =
  stripNative || smokeTest
    ? getDefaultConfig(projectRoot)
    : require('@sentry/react-native/metro').getSentryExpoConfig(projectRoot);

const useExpoGoStubs = process.env.EXPO_USE_METRO_STUBS === '1';
const disableErrorOverlay = process.env.EXPO_DISABLE_ERROR_OVERLAY === '1';

const expoGoStubs = {
  '@kingstinct/react-native-healthkit': path.resolve(projectRoot, 'src/integrations/healthkit.metro-stub.js'),
  'react-native-nitro-modules': path.resolve(projectRoot, 'src/integrations/healthkit.metro-stub.js'),
  'react-native-purchases': path.resolve(projectRoot, 'src/integrations/purchases.metro-stub.js'),
};

const stripNativeStubs = {
  ...expoGoStubs,
  'react-native-watch-connectivity': path.resolve(projectRoot, 'src/integrations/watch-connectivity.metro-stub.js'),
  'react-native-reanimated': path.resolve(projectRoot, 'src/integrations/reanimated.metro-stub.js'),
  'expo-linear-gradient': path.resolve(projectRoot, 'src/integrations/linear-gradient.metro-stub.js'),
  '@sentry/react-native': path.resolve(projectRoot, 'src/integrations/sentry.metro-stub.js'),
  'expo-notifications': path.resolve(projectRoot, 'src/integrations/notifications.metro-stub.js'),
  'expo-speech-recognition': path.resolve(projectRoot, 'src/integrations/speech-recognition.metro-stub.js'),
};

if (disableErrorOverlay) {
  expoGoStubs['@expo/metro-runtime/error-overlay'] = path.resolve(
    projectRoot,
    'src/integrations/error-overlay-stub.js',
  );
}

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  let stubPath;
  if (stripNative) {
    stubPath = stripNativeStubs[moduleName];
  } else if (useExpoGoStubs) {
    stubPath = expoGoStubs[moduleName];
  } else if (disableErrorOverlay && moduleName === '@expo/metro-runtime/error-overlay') {
    stubPath = expoGoStubs[moduleName];
  }

  if (stubPath) {
    return { type: 'sourceFile', filePath: stubPath };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
