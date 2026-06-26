import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Brand, FontFamily, LiftFlowColors } from '@/constants/theme';

type LiftFlowWordmarkProps = {
  size?: 'sm' | 'md' | 'lg';
  align?: 'left' | 'center';
  showTagline?: boolean;
  /** White text for photography overlays. */
  tone?: 'default' | 'onPhoto';
};

const SIZES = {
  sm: { fontSize: 14, lineHeight: 18, letterSpacing: 4 },
  md: { fontSize: 18, lineHeight: 24, letterSpacing: 5 },
  lg: { fontSize: 28, lineHeight: 34, letterSpacing: 5 },
} as const;

export function LiftFlowWordmark({
  size = 'md',
  align = 'center',
  showTagline = false,
  tone = 'default',
}: LiftFlowWordmarkProps) {
  const scale = SIZES[size];
  const onPhoto = tone === 'onPhoto';

  return (
    <View style={[styles.block, align === 'center' && styles.centered]}>
      <View style={[styles.row, align === 'center' && styles.centered]}>
        <AppText
          align={align}
          style={[styles.word, scale, onPhoto && styles.wordOnPhoto]}>
          {Brand.name}
        </AppText>
      </View>
      {showTagline ? (
        <AppText
          variant="label"
          color={onPhoto ? undefined : 'accent'}
          align={align}
          style={[styles.tagline, onPhoto && styles.taglineOnPhoto]}>
          {Brand.taglinePrimary}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 6,
    maxWidth: '100%',
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
  wordOnPhoto: {
    color: '#FFFFFF',
  },
  tagline: {
    letterSpacing: 2,
    marginTop: 2,
  },
  taglineOnPhoto: {
    color: 'rgba(255,255,255,0.82)',
  },
});
