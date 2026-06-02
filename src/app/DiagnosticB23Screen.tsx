import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { logStartup } from '@/startup/diagnosticLog';

export function DiagnosticB23Screen() {
  useEffect(() => {
    logStartup('first_screen_render');
  }, []);

  return (
    <View style={styles.root}>
      <Text style={styles.label}>LIFTFLOW DIAGNOSTIC BUILD 23</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    padding: 24,
  },
  label: {
    color: '#0E90FF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
});
