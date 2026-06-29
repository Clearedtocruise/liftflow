import * as Sentry from '@sentry/react-native';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { captureMobileException } from '@/lib/sentry';

type Props = {
  children: ReactNode;
  onResume: () => void;
  onEndWorkout: () => void;
};

type State = { error: Error | null };

/** Isolates mid-workout render crashes — Fitbod/Ladder users lose trust when one glitch ends a session. */
export class WorkoutExecutionErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureMobileException(error, { screen: 'active-workout' });
    Sentry.captureMessage(
      `WorkoutExecutionErrorBoundary: ${info.componentStack?.slice(0, 200) ?? 'unknown'}`,
    );
  }

  private handleResume = () => {
    this.setState({ error: null });
    this.props.onResume();
  };

  render() {
    if (this.state.error) {
      return (
        <View style={styles.root}>
          <AppText variant="headline" align="center">
            Workout paused
          </AppText>
          <AppText variant="footnote" color="textSecondary" align="center">
            Something went wrong on this screen. Your logged sets are saved — you can try resuming or end
            the workout.
          </AppText>
          <PrimaryButton label="Resume workout" onPress={this.handleResume} />
          <Pressable onPress={this.props.onEndWorkout} style={styles.secondary}>
            <AppText variant="bodyBold" color="accent" align="center">
              End workout
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
    justifyContent: 'center',
    backgroundColor: LiftFlowColors.background,
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  secondary: {
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
});
