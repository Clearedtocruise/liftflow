import { StyleSheet, View, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';

type TabScreenHeaderProps = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  style?: ViewStyle;
};

/** Consistent top-of-screen title for tab routes — pair with ScreenContainer `header`. */
export function TabScreenHeader({ title, subtitle, right, style }: TabScreenHeaderProps) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.textBlock}>
        <AppText variant="headline">{title}</AppText>
        {subtitle ? (
          <AppText variant="footnote" color="textSecondary" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginBottom: 0,
  },
  textBlock: {
    flex: 1,
    gap: Spacing.xs,
  },
  right: {
    paddingTop: 2,
  },
});
