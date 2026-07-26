import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { ProgressRing } from '@/components/ui/ProgressRing';
import {
    Gradients,
    LiftFlowColors,
    MetricAccents,
    Radius,
    Spacing,
} from '@/constants/theme';

export type HeroState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'no-program' }
  | { kind: 'workout'; name: string; exercises: string[]; extraCount: number }
  | { kind: 'rest' };

type TodayHeroCardProps = {
  state: HeroState;
  /** 0–100, only when a recovery assessment actually exists for today. */
  recoveryPercent?: number;
  recoveryLabel?: string;
  /** Latest HRV reading, shown as a badge when Apple Health has one. */
  hrvMs?: number;
  busy?: boolean;
  onStart: () => void;
  onGenerate: () => void;
  onRetry: () => void;
  onOpenRecovery: () => void;
};

export function TodayHeroCard({
  state,
  recoveryPercent,
  recoveryLabel,
  hrvMs,
  busy,
  onStart,
  onGenerate,
  onRetry,
  onOpenRecovery,
}: TodayHeroCardProps) {
  const resting = state.kind === 'rest';

  return (
    <LinearGradient
      colors={resting ? [...Gradients.recovery] : [...Gradients.hero]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.card}>
      <View style={styles.topRow}>
        <AppText variant="label" color="accent">
          TODAY
        </AppText>
        {hrvMs != null ? (
          <View style={styles.hrvBadge}>
            <AppText variant="caption" style={styles.hrvIcon}>
              ♥
            </AppText>
            <View>
              <AppText variant="caption" color="textPrimary">
                HRV
              </AppText>
              <AppText variant="caption" color="textTertiary">
                {Math.round(hrvMs)} ms
              </AppText>
            </View>
          </View>
        ) : null}
      </View>

      {state.kind === 'loading' ? (
        <ActivityIndicator color={LiftFlowColors.accent} style={styles.loader} />
      ) : state.kind === 'error' ? (
        <>
          <AppText variant="title">Can&apos;t load today</AppText>
          <AppText variant="footnote" color="textSecondary">
            We couldn&apos;t reach your training plan. Check your connection and try again.
          </AppText>
          <PrimaryButton label="Try again" onPress={onRetry} size="large" />
        </>
      ) : state.kind === 'no-program' ? (
        <>
          <AppText variant="title">Let&apos;s build your plan</AppText>
          <AppText variant="footnote" color="textSecondary">
            You don&apos;t have a training program yet. Generate your first week to get started.
          </AppText>
          <PrimaryButton
            label="Build my plan"
            onPress={onGenerate}
            loading={busy}
            disabled={busy}
            size="large"
            icon="✨"
          />
        </>
      ) : state.kind === 'rest' ? (
        <>
          <AppText variant="title">Recovery Day</AppText>
          <AppText variant="footnote" color="textSecondary">
            Nothing scheduled today. Your body needs recovery to grow stronger.
          </AppText>
          <RecoveryBlock
            percent={recoveryPercent}
            label={recoveryLabel}
            onOpenRecovery={onOpenRecovery}
          />
          <PrimaryButton
            label="Generate workout"
            onPress={onGenerate}
            loading={busy}
            disabled={busy}
            size="large"
            icon="✨"
          />
          <PrimaryButton label="Focus on Recovery" variant="secondary" onPress={onOpenRecovery} />
        </>
      ) : (
        <>
          <AppText variant="title">{state.name}</AppText>
          {state.exercises.length > 0 ? (
            <View style={styles.preview}>
              {state.exercises.map((name, index) => (
                <AppText key={`${name}-${index}`} variant="footnote" color="textSecondary">
                  {index + 1}. {name}
                </AppText>
              ))}
              {state.extraCount > 0 ? (
                <AppText variant="caption" color="textTertiary">
                  +{state.extraCount} more
                </AppText>
              ) : null}
            </View>
          ) : null}
          <RecoveryBlock
            percent={recoveryPercent}
            label={recoveryLabel}
            onOpenRecovery={onOpenRecovery}
          />
          <PrimaryButton
            label="Start Workout"
            onPress={onStart}
            loading={busy}
            disabled={busy}
            size="large"
          />
        </>
      )}
    </LinearGradient>
  );
}

/**
 * The ring only appears once a recovery assessment exists. Without one there is no score to show,
 * so this is a prompt to record one rather than a number invented to fill the space.
 */
function RecoveryBlock({
  percent,
  label,
  onOpenRecovery,
}: {
  percent?: number;
  label?: string;
  onOpenRecovery: () => void;
}) {
  if (percent == null) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onOpenRecovery}
        style={({ pressed }) => [styles.recoveryPrompt, pressed && styles.pressed]}>
        <AppText variant="label" color="textTertiary">
          RECOVERY SCORE
        </AppText>
        <AppText variant="footnote" color="accent">
          Check in to see today&apos;s score ›
        </AppText>
      </Pressable>
    );
  }

  return (
    <View style={styles.recoveryRow}>
      <ProgressRing percent={percent} size={104} thickness={8}>
        <AppText variant="headline" style={styles.recoveryValue}>
          {Math.round(percent)}%
        </AppText>
      </ProgressRing>
      <View style={styles.recoveryText}>
        <AppText variant="label" color="textTertiary">
          RECOVERY SCORE
        </AppText>
        {label ? (
          <AppText variant="footnote" style={styles.recoveryLabel}>
            {label}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.md,
    padding: Spacing.xl,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: 'rgba(14, 144, 255, 0.28)',
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  hrvBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  hrvIcon: {
    color: MetricAccents.recovery.tint,
  },
  loader: {
    marginVertical: Spacing.xl,
  },
  preview: {
    gap: 2,
  },
  recoveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    marginTop: Spacing.xs,
  },
  recoveryValue: {
    color: MetricAccents.recovery.tint,
  },
  recoveryText: {
    flex: 1,
    gap: Spacing.xs,
  },
  recoveryLabel: {
    color: MetricAccents.recovery.tint,
  },
  recoveryPrompt: {
    gap: 2,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  pressed: {
    opacity: 0.8,
  },
});
