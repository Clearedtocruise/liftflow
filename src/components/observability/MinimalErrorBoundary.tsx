import type { ReactNode } from 'react';
import { Component } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Error boundary without @sentry/react-native (avoids loading Sentry TurboModule at startup). */
export class MinimalErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[MinimalErrorBoundary]', error.message, error.stack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.root}>
          <Text style={styles.title}>Startup error</Text>
          <Text style={styles.message}>{this.state.error.message}</Text>
          <Pressable onPress={() => this.setState({ error: null })} style={styles.button}>
            <Text style={styles.buttonText}>Retry</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    padding: 24,
    gap: 12,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  message: {
    color: '#aaa',
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
    padding: 12,
  },
  buttonText: {
    color: '#0E90FF',
    fontWeight: '600',
  },
});
