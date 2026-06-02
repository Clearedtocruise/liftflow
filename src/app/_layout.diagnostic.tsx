import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Sentry } from '@/lib/sentry';
import { logStartup } from '@/startup/diagnosticLog';
import { runDiagnosticBootstrap } from '@/startup/runDiagnosticBootstrap';

runDiagnosticBootstrap();

function DiagnosticRootLayout() {
  useEffect(() => {
    logStartup('root_layout_mount');
  }, []);

  return (
    <View style={styles.root}>
      <Stack screenOptions={{ headerShown: false, contentStyle: styles.root }}>
        <Stack.Screen name="index" />
      </Stack>
    </View>
  );
}

export default Sentry.wrap(DiagnosticRootLayout);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
