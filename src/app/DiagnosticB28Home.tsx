import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function DiagnosticB28Home() {
  return (
    <View style={styles.root}>
      <Text style={styles.label}>BUILD 34 SCHEME FIX TEST</Text>
      <Text style={styles.subtitle}>Expo Router navigation test</Text>
      <Link href="/b28-second" asChild>
        <Pressable style={styles.button}>
          <Text style={styles.buttonLabel}>Go to second screen</Text>
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
  subtitle: {
    color: '#888888',
    fontSize: 14,
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
