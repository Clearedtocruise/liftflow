import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/** Only registered during Build 28 diagnostic — verifies stack navigation. */
export default function DiagnosticB28SecondScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.label}>BUILD 28 — SCREEN TWO</Text>
      <Link href="/" asChild>
        <Pressable style={styles.button}>
          <Text style={styles.buttonLabel}>Back to home</Text>
        </Pressable>
      </Link>
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
    gap: 16,
  },
  label: {
    color: '#0E90FF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#0E90FF',
  },
  buttonLabel: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
});
