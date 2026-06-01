const path = require('path');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const projectRoot = __dirname;
const config = getSentryExpoConfig(projectRoot);

/** Only stub native modules for Expo Go (`EXPO_USE_METRO_STUBS=1`). Dev/production builds use real native code. */
const useExpoGoStubs = process.env.EXPO_USE_METRO_STUBS === '1';
const disableErrorOverlay = process.env.EXPO_DISABLE_ERROR_OVERLAY === '1';

const expoGoStubs = {
  '@kingstinct/react-native-healthkit': path.resolve(projectRoot, 'src/integrations/healthkit.metro-stub.js'),
  'react-native-nitro-modules': path.resolve(projectRoot, 'src/integrations/healthkit.metro-stub.js'),
  'react-native-purchases': path.resolve(projectRoot, 'src/integrations/purchases.metro-stub.js'),
};

if (disableErrorOverlay) {
  expoGoStubs['@expo/metro-runtime/error-overlay'] = path.resolve(
    projectRoot,
    'src/integrations/error-overlay-stub.js',
  );
}

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const stubPath = expoGoStubs[moduleName];
  if (stubPath && (useExpoGoStubs || disableErrorOverlay)) {
    return { type: 'sourceFile', filePath: stubPath };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
