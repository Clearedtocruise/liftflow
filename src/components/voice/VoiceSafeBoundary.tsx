import { Component, type ReactNode } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';
import { recordCrashError } from '@/lib/crashDiagnostics';

type Props = {
  children: ReactNode;
  fallbackMessage?: string;
};

type State = { failed: boolean };

/** Catches voice render/init failures without crashing the screen. */
export class VoiceSafeBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    recordCrashError(error, { source: 'voice_safe_boundary', fatal: false });
  }

  render() {
    if (this.state.failed) {
      return (
        <View style={{ alignItems: 'center', gap: Spacing.sm }}>
          <AppText variant="caption" color="textSecondary" align="center">
            {this.props.fallbackMessage ?? 'Voice temporarily unavailable. Use manual logging.'}
          </AppText>
        </View>
      );
    }

    return this.props.children;
  }
}
