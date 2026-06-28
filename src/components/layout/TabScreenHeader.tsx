import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { BrandHeader } from '@/components/brand/BrandHeader';
import { CardLifestyleBanner } from '@/components/layout/CardLifestyleBanner';
import { AppText } from '@/components/ui/AppText';
import type { AppTheme } from '@/constants/themes';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useThemedStyles } from '@/hooks/useLiftFlowTheme';

type TabScreenHeaderProps = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  showBrand?: boolean;
  bannerUri?: string;
  style?: ViewStyle;
};

export function TabScreenHeader({
  title,
  subtitle,
  right,
  showBrand = true,
  bannerUri,
  style,
}: TabScreenHeaderProps) {
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.wrap, style]}>
      {bannerUri ? <CardLifestyleBanner uri={bannerUri} height={76} bleed={false} /> : null}
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
        colors={[...theme.brandGradients.border.default]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.accentLine}
      />
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    wrap: {
      gap: theme.spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
    },
    textBlock: {
      flex: 1,
      gap: theme.spacing.xs,
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
}
