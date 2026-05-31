import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { FontFamily, LiftFlowColors } from '@/constants/theme';

type LiftFlowWordmarkProps = {
  size?: 'sm' | 'md' | 'lg';
  align?: 'left' | 'center';
};

const SIZES = {
  sm: { fontSize: 14, letterSpacing: 4 },
  md: { fontSize: 18, letterSpacing: 5 },
  lg: { fontSize: 22, letterSpacing: 6 },
} as const;

export function LiftFlowWordmark({ size = 'md', align = 'center' }: LiftFlowWordmarkProps) {
  const scale = SIZES[size];

  return (
    <View style={[styles.row, align === 'center' && styles.centered]}>
      <AppText variant="caption" align={align} style={[styles.word, scale]}>
        LIFT
      </AppText>
      <AppText variant="caption" color="accent" align={align} style={[styles.word, scale]}>
        FLOW
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  centered: {
    justifyContent: 'center',
  },
  word: {
    fontFamily: FontFamily.hero,
    fontWeight: '800',
    color: LiftFlowColors.textPrimary,
  },
});
