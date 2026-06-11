import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { captureMobileException } from '@/lib/sentry';

type Props = {
  children: ReactNode;
  screenName: string;
};

type State = {
  error: Error | null;
  componentStack: string;
};

export class ScreenErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureMobileException(error, { screen: this.props.screenName });
    this.setState({ componentStack: info.componentStack ?? '' });
  }

  private handleRetry = () => {
    this.setState({ error: null, componentStack: '' });
  };

  render() {
    if (this.state.error) {
      return (
        <View style={styles.root}>
          <AppText variant="headline" align="center">
            {this.props.screenName} crashed
          </AppText>
          <AppText variant="bodyBold" color="error" align="center" style={styles.message}>
            {this.state.error.message || 'Unknown error'}
          </AppText>
          <ScrollView style={styles.stackScroll} contentContainerStyle={styles.stackContent}>
            <AppText variant="caption" color="textSecondary" style={styles.mono}>
              {this.state.error.stack ?? 'No stack trace'}
            </AppText>
            {this.state.componentStack ? (
              <AppText variant="caption" color="textSecondary" style={styles.mono}>
                {'\n--- component stack ---\n'}
                {this.state.componentStack}
              </AppText>
            ) : null}
          </ScrollView>
          <Pressable onPress={this.handleRetry} style={styles.button}>
            <AppText variant="bodyBold" color="accent">
              Retry
            </AppText>
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
    backgroundColor: LiftFlowColors.background,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  message: {
    marginTop: Spacing.sm,
  },
  stackScroll: {
    flex: 1,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    borderRadius: Radius.md,
  },
  stackContent: {
    padding: Spacing.md,
  },
  mono: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },
  button: {
    alignSelf: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
});
