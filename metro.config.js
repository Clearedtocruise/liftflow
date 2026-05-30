const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

/** Only stub native modules for Expo Go (`EXPO_USE_METRO_STUBS=1`). Dev/production builds use real native code. */
const useExpoGoStubs = process.env.EXPO_USE_METRO_STUBS === '1';

const expoGoStubs = {
  '@kingstinct/react-native-healthkit': path.resolve(projectRoot, 'src/integrations/healthkit.metro-stub.js'),
  'react-native-nitro-modules': path.resolve(projectRoot, 'src/integrations/healthkit.metro-stub.js'),
  'react-native-purchases': path.resolve(projectRoot, 'src/integrations/purchases.metro-stub.js'),
};

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (useExpoGoStubs) {
    const stubPath = expoGoStubs[moduleName];
    if (stubPath) {
      return { type: 'sourceFile', filePath: stubPath };
    }
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
