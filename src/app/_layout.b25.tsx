import { Slot } from 'expo-router';
import { StyleSheet, View } from 'react-native';

/** Build 25: bare Expo Router shell — no providers, Sentry, or native init. */
export default function DiagnosticB25Layout() {
  return (
    <View style={styles.root}>
      <Slot />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
