import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import type { AppTheme } from '@/constants/themes';
import { useThemedStyles } from '@/hooks/useLiftFlowTheme';

type NutritionMetricsRowProps = {
  caloriesLabel?: string;
  caloriesValue: string;
  caloriesFooter?: string;
  proteinLabel?: string;
  proteinValue?: string;
  proteinFooter?: string;
  mealsLabel?: string;
  mealsValue?: string;
  mealsFooter?: string;
  /** `tiles` = three-up on Home; `rows` = stacked rows for Nutrition tab. */
  layout?: 'tiles' | 'rows';
};

type MetricSpec = {
  key: string;
  label: string;
  value: string;
  detail?: string;
  accent?: boolean;
};

function MetricTile({
  label,
  value,
  detail,
  accent,
  styles,
}: {
  label: string;
  value: string;
  detail?: string;
  accent?: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.tile}>
      <AppText
        variant="title"
        color={accent ? 'accent' : 'textPrimary'}
        style={styles.tileValue}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}>
        {value}
      </AppText>
      {detail ? (
        <AppText variant="caption" color="textTertiary" numberOfLines={1}>
          {detail}
        </AppText>
      ) : null}
      <AppText variant="caption" color="textTertiary" style={styles.tileLabel} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

function MetricRow({
  label,
  value,
  detail,
  accent,
  styles,
}: {
  label: string;
  value: string;
  detail?: string;
  accent?: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.rowLine}>
      <AppText variant="footnote" color="textSecondary" style={styles.rowLabel}>
        {label}
      </AppText>
      <View style={styles.rowValueBlock}>
        <AppText variant="bodyBold" color={accent ? 'accent' : 'textPrimary'} numberOfLines={1}>
          {value}
        </AppText>
        {detail ? (
          <AppText variant="caption" color="textTertiary" numberOfLines={1}>
            {detail}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

/** Macro summary — readable in light and dark without cramped nested cards. */
export function NutritionMetricsRow({
  caloriesLabel = 'Calories',
  caloriesValue,
  caloriesFooter,
  proteinLabel = 'Protein',
  proteinValue,
  proteinFooter,
  mealsLabel = 'Meals',
  mealsValue,
  mealsFooter,
  layout = 'tiles',
}: NutritionMetricsRowProps) {
  const styles = useThemedStyles(createStyles);

  const metrics: MetricSpec[] = [
    {
      key: 'cal',
      label: caloriesLabel,
      value: caloriesValue,
      detail: caloriesFooter,
      accent: true,
    },
  ];

  if (proteinValue != null) {
    metrics.push({
      key: 'protein',
      label: proteinLabel,
      value: proteinValue,
      detail: proteinFooter,
    });
  }

  if (mealsValue != null) {
    metrics.push({
      key: 'meals',
      label: mealsLabel,
      value: mealsValue,
      detail: mealsFooter,
    });
  }

  if (layout === 'rows') {
    return (
      <View style={styles.rowsWrap}>
        {metrics.map((metric) => (
          <MetricRow
            key={metric.key}
            label={metric.label}
            value={metric.value}
            detail={metric.detail}
            accent={metric.accent}
            styles={styles}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.tilesWrap}>
      {metrics.map((metric, index) => (
        <View key={metric.key} style={styles.tileSlot}>
          {index > 0 ? <View style={styles.tileDivider} /> : null}
          <MetricTile
            label={metric.label}
            value={metric.value}
            detail={metric.detail}
            accent={metric.accent}
            styles={styles}
          />
        </View>
      ))}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    tilesWrap: {
      flexDirection: 'row',
      alignItems: 'stretch',
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundSecondary,
      overflow: 'hidden',
    },
    tileSlot: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'stretch',
      minWidth: 0,
    },
    tileDivider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
      alignSelf: 'stretch',
    },
    tile: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.xs,
      gap: 4,
    },
    tileValue: {
      fontSize: 28,
      lineHeight: 32,
      width: '100%',
      textAlign: 'center',
    },
    tileLabel: {
      width: '100%',
      textAlign: 'center',
      fontSize: 12,
      lineHeight: 14,
    },
    rowsWrap: {
      gap: theme.spacing.sm,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundSecondary,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
    },
    rowLine: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    rowLabel: {
      flexShrink: 0,
      minWidth: 72,
    },
    rowValueBlock: {
      flex: 1,
      alignItems: 'flex-end',
      gap: 2,
      minWidth: 0,
    },
  });
}
