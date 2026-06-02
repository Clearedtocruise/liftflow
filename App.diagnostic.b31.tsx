import 'react-native-gesture-handler';

import { StyleSheet, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

/** Build 31: B27 baseline + react-native-gesture-handler only. */
export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <Text style={styles.label}>BUILD 31 GESTURE TEST</Text>
    </GestureHandlerRootView>
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
