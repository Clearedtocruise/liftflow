import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { BrandHeader } from '@/components/brand/BrandHeader';
import { AppText } from '@/components/ui/AppText';
import { BrandGradients, Spacing } from '@/constants/theme';

type TabScreenHeaderProps = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  /** Show ONE MORE wordmark eyebrow above the title. */
  showBrand?: boolean;
  style?: ViewStyle;
};

/** Consistent top-of-screen title for tab routes — pair with ScreenContainer `header`. */
export function TabScreenHeader({
  title,
  subtitle,
  right,
  showBrand = true,
  style,
}: TabScreenHeaderProps) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.row}>
        <View style={styles.textBlock}>
          {showBrand ? <BrandHeader compact /> : null}
          <AppText variant="headline">{title}</AppText>
          {subtitle ? (
            <AppText variant="footnote" color="textSecondary" numberOfLines={2}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      <LinearGradient
        colors={[...BrandGradients.border.default]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.accentLine}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  textBlock: {
    flex: 1,
    gap: Spacing.xs,
  },
  right: {
    paddingTop: 2,
  },
  accentLine: {
    width: 48,
    height: 3,
    borderRadius: 2,
  },
});
