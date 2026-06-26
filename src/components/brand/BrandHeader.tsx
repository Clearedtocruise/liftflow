import { StyleSheet, View } from 'react-native';

import { LiftFlowWordmark } from '@/components/brand/LiftFlowWordmark';
import { LogoMark } from '@/components/brand/LogoMark';
import { AppText } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';

type BrandHeaderProps = {
  subtitle?: string;
  compact?: boolean;
};

/** ONE MORE wordmark strip for tab screens. */
export function BrandHeader({ subtitle, compact = false }: BrandHeaderProps) {
  return (
    <View style={styles.row}>
      <LogoMark size={compact ? 32 : 40} glow={false} animate={false} compact />
      <View style={styles.textBlock}>
        <LiftFlowWordmark size={compact ? 'sm' : 'md'} align="left" />
        {subtitle ? (
          <AppText variant="caption" color="textSecondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
});
