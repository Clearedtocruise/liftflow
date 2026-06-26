import '@/lib/disableWebErrorOverlay';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FontProvider } from '@/components/brand/FontProvider';
import { StartupErrorBoundary } from '@/components/observability/StartupErrorBoundary';
import { LiftFlowColors } from '@/constants/theme';
import { initMobileSentry, Sentry } from '@/lib/sentry';
import { markAppStart } from '@/lib/startupLogger';
import { AppProviders } from '@/state/AppProviders';

initMobileSentry();

function RootLayout() {
  useEffect(() => {
    markAppStart();
  }, []);
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StartupErrorBoundary>
          <FontProvider>
            <AppProviders>
              <StatusBar style="dark" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: LiftFlowColors.background },
                  animation: 'fade',
                }}>
                <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
                <Stack.Screen name="why-liftflow" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(onboarding)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="session/[id]" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen
                  name="(features)"
                  options={{ animation: 'slide_from_right', headerShown: false }}
                />
                <Stack.Screen name="legal" options={{ animation: 'slide_from_right' }} />
              </Stack>
            </AppProviders>
          </FontProvider>
        </StartupErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LiftFlowColors.background,
  },
});
