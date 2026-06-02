import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { enableScreens } from 'react-native-screens';

enableScreens(true);

/** Build 30: B27 baseline + react-native-screens only. */
export default function App() {
  useEffect(() => {
    enableScreens(true);
  }, []);

  return (
    <View style={styles.root}>
      <Text style={styles.label}>BUILD 30 SCREENS TEST</Text>
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
