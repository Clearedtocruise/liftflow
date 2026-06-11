import '@/lib/disableWebErrorOverlay';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FontProvider } from '@/components/brand/FontProvider';
import { BootTestShell } from '@/components/observability/BootTestShell';
import { StartupErrorBoundary } from '@/components/observability/StartupErrorBoundary';
import { LiftFlowColors } from '@/constants/theme';
import { DIAGNOSTIC_BOOT_TEST, diagnosticAtLeast } from '@/constants/diagnosticMode';
import { forensicLog, installForensicCrashHandlers } from '@/lib/forensicLog';
import { initMobileSentry, Sentry } from '@/lib/sentry';
import { DiagnosticAppShell } from '@/state/DiagnosticAppShell';

forensicLog('APP_START', {
  bootTest: DIAGNOSTIC_BOOT_TEST,
  stage: process.env.EXPO_PUBLIC_DIAGNOSTIC_STAGE ?? 'boot',
});

installForensicCrashHandlers();

if (diagnosticAtLeast('full')) {
  initMobileSentry();
}

function RootLayout() {
  const useFullShell = diagnosticAtLeast('supabase');

  if (!useFullShell) {
    return (
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <StartupErrorBoundary>
            <BootTestShell />
            <StatusBar style="light" />
          </StartupErrorBoundary>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StartupErrorBoundary>
          <FontProvider>
            <DiagnosticAppShell>
              <StatusBar style="light" />
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
            </DiagnosticAppShell>
          </FontProvider>
        </StartupErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const WrappedRootLayout = diagnosticAtLeast('full') ? Sentry.wrap(RootLayout) : RootLayout;

export default WrappedRootLayout;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LiftFlowColors.background,
  },
});
