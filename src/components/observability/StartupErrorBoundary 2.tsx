import * as Sentry from '@sentry/react-native';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { LogoMark } from '@/components/brand/LogoMark';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { captureMobileException } from '@/lib/sentry';

type Props = { children: ReactNode };

type State = { error: Error | null };

export class StartupErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureMobileException(error, { screen: 'startup' });
    Sentry.captureMessage(`StartupErrorBoundary: ${info.componentStack?.slice(0, 200) ?? 'unknown'}`);
  }

  private handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <View style={styles.root}>
          <LogoMark size={72} glow={false} animate={false} />
          <AppText variant="headline" align="center" style={styles.title}>
            ONE MORE hit a snag
          </AppText>
          <AppText variant="footnote" color="textSecondary" align="center">
            {this.state.error.message || 'Unexpected startup error'}
          </AppText>
          <Pressable onPress={this.handleRetry} style={styles.button}>
            <AppText variant="bodyBold" color="accent">
              Try Again
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LiftFlowColors.background,
    padding: Spacing.xxl,
    gap: Spacing.lg,
  },
  title: {
    marginTop: Spacing.lg,
  },
  button: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
});
