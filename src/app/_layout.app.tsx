import '@/lib/disableWebErrorOverlay';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FontProvider } from '@/components/brand/FontProvider';
import { MinimalErrorBoundary } from '@/components/observability/MinimalErrorBoundary';
import { StartupErrorBoundary } from '@/components/observability/StartupErrorBoundary';
import { MINIMAL_STARTUP, SMOKE_TEST, STRIP_NATIVE } from '@/config/startupFlags';
import { LiftFlowColors } from '@/constants/theme';
import { AuthProvider } from '@/contexts/AuthContext';
import { initMobileSentry, Sentry } from '@/lib/sentry';
import { AppProviders } from '@/state/AppProviders';

if (!MINIMAL_STARTUP) {
  initMobileSentry();
}

function BareShell({ children }: { children: ReactNode }) {
  return (
    <View style={styles.root}>
      <SafeAreaProvider>
        <MinimalErrorBoundary>
          {SMOKE_TEST ? (
            <>
              <StatusBar style="light" />
              {children}
            </>
          ) : (
            <AuthProvider>
              <StatusBar style="light" />
              {children}
            </AuthProvider>
          )}
        </MinimalErrorBoundary>
      </SafeAreaProvider>
    </View>
  );
}

function MinimalShell({ children }: { children: ReactNode }) {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StartupErrorBoundary>
          <FontProvider>
            <AuthProvider>
              <StatusBar style="light" />
              {children}
            </AuthProvider>
          </FontProvider>
        </StartupErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootLayout() {
  if (SMOKE_TEST) {
    return (
      <BareShell>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: LiftFlowColors.background },
            animation: 'fade',
          }}>
          <Stack.Screen name="index" />
        </Stack>
      </BareShell>
    );
  }

  if (STRIP_NATIVE) {
    return (
      <BareShell>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: LiftFlowColors.background },
            animation: 'fade',
          }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
        </Stack>
      </BareShell>
    );
  }

  if (MINIMAL_STARTUP) {
    return (
      <MinimalShell>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: LiftFlowColors.background },
            animation: 'fade',
          }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
        </Stack>
      </MinimalShell>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StartupErrorBoundary>
          <FontProvider>
            <AppProviders>
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
            </AppProviders>
          </FontProvider>
        </StartupErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default MINIMAL_STARTUP || SMOKE_TEST ? RootLayout : Sentry.wrap(RootLayout);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LiftFlowColors.background,
  },
});
