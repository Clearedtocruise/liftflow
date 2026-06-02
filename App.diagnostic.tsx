import { StyleSheet, Text, View } from 'react-native';

/** Build 26: plain RN Text — no router, providers, or native module init. */
export default function App() {
  return (
    <View style={styles.root}>
      <Text style={styles.label}>BUILD 26 DIAGNOSTIC</Text>
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
