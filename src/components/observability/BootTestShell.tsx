import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { DIAGNOSTIC_BOOT_TEST, DIAGNOSTIC_STAGE } from '@/constants/diagnosticMode';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { forensicLog } from '@/lib/forensicLog';

/** Minimal shell — no Supabase, RevenueCat, fonts, Sentry, or tab providers. */
export function BootTestShell({ children }: { children?: ReactNode }) {
  useEffect(() => {
    forensicLog('APP_BOOT_COMPLETE', {
      mode: 'boot_test',
      stage: DIAGNOSTIC_STAGE,
    });
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      {children ?? (
        <View style={styles.center}>
          <AppText variant="display" align="center">
            BOOT TEST
          </AppText>
          <AppText variant="caption" color="textSecondary" align="center" style={styles.sub}>
            Diagnostic stage: {DIAGNOSTIC_STAGE}
            {DIAGNOSTIC_BOOT_TEST ? ' (isolated)' : ''}
          </AppText>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LiftFlowColors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  sub: {
    marginTop: Spacing.sm,
  },
});
