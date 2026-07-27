import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { CelebrationBurst } from '@/components/dashboard/CelebrationBurst';
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
import { isDaytimeHour, resolveHeroBackdrop } from '@/lib/heroBackdrop';

export type HeroState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'no-program' }
  | { kind: 'workout'; name: string; exercises: string[]; extraCount: number }
  | { kind: 'in-progress'; name: string; exercises: string[]; extraCount: number }
  | { kind: 'completed'; name: string }
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
  onManageWorkout?: () => void;
  onContinueWorkout?: () => void;
  onViewHistory?: () => void;
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
  onManageWorkout,
  onContinueWorkout,
  onViewHistory,
}: TodayHeroCardProps) {
  const resting = state.kind === 'rest';
  const celebrating = state.kind === 'completed';
  const hour = new Date().getHours();
  const backdrop = resolveHeroBackdrop(resting ? 'recovery' : 'workout', hour);
  // A day photo needs less dimming than a night one to stay recognisable, but the text still has to
  // clear contrast, so the scrim lightens at the top only.
  const scrim: readonly [string, string, string] = isDaytimeHour(hour)
    ? ['rgba(8,11,16,0.20)', 'rgba(8,11,16,0.72)', 'rgba(8,11,16,0.94)']
    : ['rgba(8,11,16,0.35)', 'rgba(8,11,16,0.82)', 'rgba(8,11,16,0.96)'];
  const cardColors = celebrating
    ? (['#0B3B2E', '#10243A', '#080B10'] as const)
    : resting
      ? Gradients.recovery
      : Gradients.hero;

  return (
    <LinearGradient
      colors={[...cardColors]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={[styles.card, celebrating && styles.cardCelebrating]}>
      <Image source={backdrop} style={styles.backdrop} contentFit="cover" transition={220} />
      <LinearGradient colors={[...scrim]} style={styles.backdropScrim} />
      {celebrating ? <CelebrationBurst seed={state.name} /> : null}

      <View style={styles.topRow}>
        <AppText variant="label" color="accent">
          {celebrating ? 'SESSION DONE' : 'TODAY'}
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
      ) : state.kind === 'completed' ? (
        <>
          <AppText variant="title">Workout Complete</AppText>
          <AppText variant="footnote" color="textSecondary">
            Congratulations — {state.name} is in the books. Recover well and come back stronger.
          </AppText>
          <RecoveryBlock
            percent={recoveryPercent}
            label={recoveryLabel}
            onOpenRecovery={onOpenRecovery}
          />
          <PrimaryButton
            label="View History"
            onPress={onViewHistory ?? onOpenRecovery}
            size="large"
          />
          <PrimaryButton label="Focus on Recovery" variant="secondary" onPress={onOpenRecovery} />
        </>
      ) : state.kind === 'rest' ? (
        <>
          <AppText variant="title">Recovery Day</AppText>
          <AppText variant="footnote" color="textSecondary">
            Your body needs recovery to grow stronger.
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
      ) : state.kind === 'in-progress' ? (
        <>
          <AppText variant="title">{state.name}</AppText>
          <AppText variant="footnote" color="textSecondary">
            Session in progress — pick up where you left off.
          </AppText>
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
          <PrimaryButton
            label="Continue Workout"
            onPress={onContinueWorkout ?? onStart}
            loading={busy}
            disabled={busy}
            size="large"
          />
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
          {onManageWorkout ? (
            <PrimaryButton
              label="Replace Exercises"
              variant="secondary"
              onPress={onManageWorkout}
              disabled={busy}
            />
          ) : null}
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
        <AppText variant="caption" color="textTertiary">
          {readinessLine(percent)}
        </AppText>
      </View>
    </View>
  );
}

/** Turns the score into the one thing the lifter wants from it: whether to train today. */
function readinessLine(percent: number): string {
  if (percent >= 85) return "You're ready when you are.";
  if (percent >= 60) return 'Good to train — keep the effort honest.';
  if (percent >= 40) return 'Train lighter than usual today.';
  return 'Prioritise rest over volume today.';
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
  cardCelebrating: {
    borderColor: 'rgba(0, 229, 168, 0.35)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropScrim: {
    ...StyleSheet.absoluteFillObject,
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
