import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import type { DailyRecoveryCheckIn, RecoveryTrendPoint } from '@/types/coaching';

type RecoveryScoreCardProps = {
  checkIn: DailyRecoveryCheckIn | null;
  trend?: RecoveryTrendPoint[];
};

export function RecoveryScoreCard({ checkIn, trend }: RecoveryScoreCardProps) {
  const score = checkIn?.recoveryScore;
  const recent = trend?.slice(-7) ?? [];

  return (
    <Card style={styles.card} accent={checkIn?.recoveryModeActive}>
      <View style={styles.header}>
        <View>
          <AppText variant="caption" color="textSecondary">
            Recovery Score
          </AppText>
          <AppText variant="metric" color={score != null && score < 40 ? 'restTimer' : 'accent'}>
            {score ?? '—'}
          </AppText>
        </View>
        {checkIn?.recoveryModeActive ? (
          <View style={styles.modeBadge}>
            <AppText variant="caption" color="restTimer">
              Recovery Mode
            </AppText>
          </View>
        ) : null}
      </View>

      <AppText variant="body" color="textSecondary">
        {checkIn?.dailyRecommendation ?? 'Complete today\'s check-in to personalize training and nutrition.'}
      </AppText>

      {recent.length > 1 ? (
        <View style={styles.trendRow}>
          {recent.map((point) => (
            <View key={point.checkInDate} style={styles.trendBarWrap}>
              <View
                style={[
                  styles.trendBar,
                  {
                    height: Math.max(8, (point.recoveryScore / 100) * 48),
                    backgroundColor:
                      point.recoveryScore < 40
                        ? LiftFlowColors.restTimer
                        : point.recoveryScore < 60
                          ? LiftFlowColors.textTertiary
                          : LiftFlowColors.accent,
                  },
                ]}
              />
              <AppText variant="caption" color="textTertiary" style={styles.trendLabel}>
                {point.checkInDate.slice(5)}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.md, marginBottom: Spacing.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  modeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 999,
    backgroundColor: LiftFlowColors.restTimerMuted,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  trendBarWrap: { alignItems: 'center', flex: 1, gap: Spacing.xs },
  trendBar: { width: '100%', borderRadius: 4, minHeight: 8 },
  trendLabel: { fontSize: 9 },
});
