import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Brand, FontFamily, LiftFlowColors } from '@/constants/theme';

type LiftFlowWordmarkProps = {
  size?: 'sm' | 'md' | 'lg';
  align?: 'left' | 'center';
  showTagline?: boolean;
};

const SIZES = {
  sm: { fontSize: 14, letterSpacing: 4 },
  md: { fontSize: 18, letterSpacing: 5 },
  lg: { fontSize: 22, letterSpacing: 6 },
} as const;

export function LiftFlowWordmark({ size = 'md', align = 'center', showTagline = false }: LiftFlowWordmarkProps) {
  const scale = SIZES[size];

  return (
    <View style={[styles.block, align === 'center' && styles.centered]}>
      <View style={[styles.row, align === 'center' && styles.centered]}>
        <AppText variant="caption" align={align} style={[styles.word, scale]}>
          {Brand.name}
        </AppText>
      </View>
      {showTagline ? (
        <AppText variant="label" color="accent" align={align} style={styles.tagline}>
          {Brand.taglinePrimary}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  word: {
    fontFamily: FontFamily.hero,
    fontWeight: '800',
    color: LiftFlowColors.textPrimary,
  },
  tagline: {
    letterSpacing: 2,
    marginTop: 2,
  },
});
