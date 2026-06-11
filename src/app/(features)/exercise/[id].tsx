import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Pressable, StyleSheet, View } from 'react-native';

import { ExerciseHeroCard } from '@/components/exercise/ExerciseHeroCard';
import { ExerciseHistoryGraph } from '@/components/exercise/ExerciseHistoryGraph';
import { ExerciseLoggingPanel } from '@/components/exercise/ExerciseLoggingPanel';
import { Card } from '@/components/layout/Card';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { AppText } from '@/components/ui/AppText';
import { resolveExerciseRef as refOf } from '@/constants/exerciseDatabase';
import { muscleLabels } from '@/constants/muscles';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { getTrainingGoalLabel } from '@/constants/trainingGoals';
import { useAuth } from '@/hooks/useAuth';
import { useExerciseStats } from '@/hooks/useExerciseStats';
import { useUnits } from '@/hooks/useUnits';
import { fetchExerciseCard } from '@/lib/exerciseCardResolver';
import type { ExerciseStats } from '@/services/exerciseStatsService';
import type { ExerciseCardData } from '@/types/exerciseCard';

export default function ExerciseCardScreen() {
  const params = useLocalSearchParams<{ id?: string; name?: string; exerciseId?: string }>();
  const slug = typeof params.id === 'string' ? params.id : undefined;
  const name = typeof params.name === 'string' ? params.name : undefined;

  const [card, setCard] = useState<ExerciseCardData | null>(null);

  useEffect(() => {
    let active = true;
    fetchExerciseCard({ slug, name, id: params.exerciseId as string | undefined }).then((c) => {
      if (active) setCard(c);
    });
    return () => {
      active = false;
    };
  }, [slug, name, params.exerciseId]);

  const { stats, loading, refresh } = useExerciseStats({
    slug: card?.slug,
    name: card?.name,
    metric: card?.metric,
  });

  if (!card) {
    return (
      <ScreenContainer scroll={false}>
        <Stack.Screen options={{ title: 'Exercise' }} />
        <View style={styles.loader}>
          <ActivityIndicator color={LiftFlowColors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bottomInset={false}>
      <Stack.Screen options={{ title: card.name }} />

      {/* HERO — name, muscles, difficulty, equipment + anatomy figure */}
      <View style={styles.heroSection}>
        <ExerciseHeroCard card={card} />
      </View>

      {/* QUICK COACHING */}
      {card.coachingCues.length > 0 ? (
        <Section title="Quick Coaching">
          <BulletList items={card.coachingCues} tone="primary" />
        </Section>
      ) : null}

      {/* COMMON MISTAKES */}
      {card.commonMistakes.length > 0 ? (
        <Section title="Common Mistakes">
          <BulletList items={card.commonMistakes} tone="error" symbol="✕" />
        </Section>
      ) : null}

      {/* WHAT SHOULD I FEEL */}
      <Section title="What Should I Feel?">
        <Card>
          <View style={styles.feelRow}>
            <View style={styles.feelBlock}>
              <AppText variant="label" color="error">
                Primary Burn
              </AppText>
              {muscleLabels(card.feel.primary).map((m) => (
                <AppText key={m} variant="bodyBold">
                  {m}
                </AppText>
              ))}
            </View>
            {card.feel.secondary.length > 0 ? (
              <View style={styles.feelBlock}>
                <AppText variant="label" color="primary">
                  Secondary Burn
                </AppText>
                {muscleLabels(card.feel.secondary).map((m) => (
                  <AppText key={m} variant="body" color="textSecondary">
                    {m}
                  </AppText>
                ))}
              </View>
            ) : null}
          </View>
        </Card>
      </Section>

      {/* LOGGING — stay on card to log sets */}
      <Section title="Log This Exercise" subtitle="Weight · Reps · Sets · Rest · Voice">
        <Card elevated>
          <ExerciseLoggingPanel exercise={card} onLogged={refresh} />
        </Card>
      </Section>

      {/* PERSONAL PERFORMANCE */}
      <Section title="Personal Performance">
        <PersonalPerformance card={card} stats={stats} loading={loading} />
      </Section>

      {/* PROGRESSION */}
      <Section title="Progression">
        <ProgressionSection card={card} stats={stats} />
      </Section>

      {/* HISTORY */}
      <Section title="History">
        <HistorySection card={card} stats={stats} />
      </Section>

      {/* RECORDS */}
      <Section title="Records">
        <RecordsSection card={card} stats={stats} />
      </Section>

      {/* AI COACH */}
      <Section title="AI Coach">
        <AICoachSection card={card} stats={stats} />
      </Section>

      {/* ALTERNATIVES */}
      {card.alternatives.length > 0 ? (
        <Section title="Alternatives" subtitle="Same goal — swap instantly">
          <ExerciseRefList slugs={card.alternatives} currentName={card.name} />
        </Section>
      ) : null}

      {/* REPLACEMENTS */}
      {card.replacements.length > 0 ? (
        <Section title="Replacements" subtitle="Equipment-independent options">
          <ExerciseRefList slugs={card.replacements} currentName={card.name} showEquipment />
        </Section>
      ) : null}
    </ScreenContainer>
  );
}

// ───────────────────────── Sections ─────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <SectionHeader title={title} subtitle={subtitle} />
      {children}
    </View>
  );
}

function PersonalPerformance({
  card,
  stats,
  loading,
}: {
  card: ExerciseCardData;
  stats: ExerciseStats | null;
  loading: boolean;
}) {
  const units = useUnits();
  const weighted = card.metric === 'reps_weight';

  const best = !stats?.hasData
    ? '—'
    : weighted && stats.personalBestWeightKg
      ? `${units.formatWeight(stats.personalBestWeightKg)}`
      : `${stats.personalBestReps ?? 0} reps`;

  const last = stats?.lastSession ? stats.lastSession.reps.join(' / ') : '—';
  const monthly = !stats?.hasData
    ? '—'
    : weighted
      ? units.formatWeight(stats.monthlyVolumeKg)
      : `${stats.monthlyReps.toLocaleString()} reps`;
  const lifetime = !stats?.hasData
    ? '—'
    : weighted
      ? units.formatWeight(stats.lifetimeVolumeKg)
      : `${stats.lifetimeReps.toLocaleString()} reps`;

  return (
    <View style={styles.statGrid}>
      <StatTile label="Personal Best" value={loading ? '…' : best} accent />
      <StatTile label="Last Session" value={loading ? '…' : last} />
      <StatTile label="Monthly Volume" value={loading ? '…' : monthly} />
      <StatTile label="Lifetime Volume" value={loading ? '…' : lifetime} />
    </View>
  );
}

function ProgressionSection({ card, stats }: { card: ExerciseCardData; stats: ExerciseStats | null }) {
  const units = useUnits();
  const weighted = card.metric === 'reps_weight';

  const currentReps = stats?.currentTopReps;
  const goalReps = card.defaultRepGoal ?? (currentReps ? currentReps + 3 : undefined);

  let current = '—';
  let goal = '—';
  let recommendation = `Log a session to unlock a personalized ${card.name} recommendation.`;

  if (stats?.hasData) {
    if (weighted && stats.currentTopWeightKg) {
      current = `${units.formatWeight(stats.currentTopWeightKg)} × ${currentReps ?? 0}`;
      goal = `${units.formatWeight(stats.currentTopWeightKg)} × ${(currentReps ?? 0) + 2}`;
      recommendation = `Add 2 reps at this weight, then add ${units.formatWeight((stats.currentTopWeightKg ?? 0) + units.weightStepKg())} next session.`;
    } else if (currentReps != null) {
      current = `${currentReps} reps`;
      goal = `${goalReps ?? currentReps + 3} reps`;
      recommendation = `Add ${Math.max(1, (goalReps ?? currentReps + 3) - currentReps)} reps next session — aim for ${goalReps ?? currentReps + 3}.`;
    }
  }

  return (
    <Card>
      <View style={styles.progressionRow}>
        <View style={styles.progressionCol}>
          <AppText variant="label" color="textTertiary">
            Current
          </AppText>
          <AppText variant="headline">{current}</AppText>
        </View>
        <AppText variant="title" color="textTertiary">
          →
        </AppText>
        <View style={styles.progressionCol}>
          <AppText variant="label" color="textTertiary">
            Goal
          </AppText>
          <AppText variant="headline" color="primary">
            {goal}
          </AppText>
        </View>
      </View>
      <View style={styles.recommendation}>
        <AppText variant="label" color="primary">
          AI Recommendation
        </AppText>
        <AppText variant="body" color="textSecondary">
          {recommendation}
        </AppText>
      </View>
    </Card>
  );
}

function HistorySection({ card, stats }: { card: ExerciseCardData; stats: ExerciseStats | null }) {
  const units = useUnits();
  const weighted = card.metric === 'reps_weight';
  const width = Dimensions.get('window').width - Spacing.xl * 2 - Spacing.lg * 2;

  if (!stats?.hasData || stats.recentSessions.length === 0) {
    return (
      <Card>
        <AppText variant="body" color="textSecondary">
          No sessions logged yet. Your trend graph appears after a few {card.name} sessions.
        </AppText>
      </Card>
    );
  }

  const graphValues = stats.recentSessions.map((s) =>
    weighted ? Math.round((s.topWeightKg ?? 0) * (1 + s.topReps / 30)) : s.topReps,
  );

  const trend =
    stats.improvementPct30d == null
      ? 'Building baseline'
      : stats.improvementPct30d > 0
        ? `Trending up ${stats.improvementPct30d}% (30d)`
        : stats.improvementPct30d < 0
          ? `Down ${Math.abs(stats.improvementPct30d)}% (30d)`
          : 'Holding steady (30d)';

  return (
    <Card>
      <View style={styles.trendHeader}>
        <AppText variant="caption" color="textSecondary">
          Performance Trend
        </AppText>
        <AppText variant="caption" color={stats.improvementPct30d && stats.improvementPct30d < 0 ? 'warning' : 'success'}>
          {trend}
        </AppText>
      </View>
      <ExerciseHistoryGraph values={graphValues} width={width} />
      <View style={styles.sessionList}>
        {[...stats.recentSessions].reverse().map((s) => (
          <View key={s.sessionId} style={styles.sessionRow}>
            <AppText variant="footnote" color="textSecondary">
              {formatDate(s.date)}
            </AppText>
            <AppText variant="footnote" color="textPrimary">
              {weighted
                ? `${units.formatWeight(s.topWeightKg)} × ${s.topReps}`
                : `${s.topReps} reps`}
            </AppText>
          </View>
        ))}
      </View>
    </Card>
  );
}

function RecordsSection({ card, stats }: { card: ExerciseCardData; stats: ExerciseStats | null }) {
  const units = useUnits();
  const weighted = card.metric === 'reps_weight';
  return (
    <View style={styles.statGrid}>
      <StatTile label="Best Reps" value={stats?.personalBestReps ? `${stats.personalBestReps}` : '—'} />
      <StatTile
        label="Best Weight"
        value={weighted && stats?.personalBestWeightKg ? units.formatWeight(stats.personalBestWeightKg) : weighted ? '—' : 'Bodyweight'}
      />
      <StatTile
        label="Best Set Volume"
        value={stats?.bestSetVolumeKg ? units.formatWeight(stats.bestSetVolumeKg) : '—'}
      />
      <StatTile label="Most Sets" value={stats?.mostSetsInSession ? `${stats.mostSetsInSession}` : '—'} />
    </View>
  );
}

function AICoachSection({ card, stats }: { card: ExerciseCardData; stats: ExerciseStats | null }) {
  const { user } = useAuth();
  const units = useUnits();
  const weighted = card.metric === 'reps_weight';
  const lines: string[] = [];
  const primaryGoal = user?.fitnessGoals?.[0];

  if (stats?.hasData) {
    if (primaryGoal) {
      const goalLabel = getTrainingGoalLabel(primaryGoal);
      if (primaryGoal === 'strength' && weighted) {
        lines.push(
          `Your ${goalLabel} goal on ${card.name}: add load only after you hit your top-set rep target at the current weight.`,
        );
      } else if (primaryGoal === 'hypertrophy' || primaryGoal === 'muscle_gain') {
        const vol = weighted
          ? `${units.formatWeight(stats.monthlyVolumeKg)} this month`
          : `${stats.monthlyReps.toLocaleString()} reps this month`;
        lines.push(`Your ${goalLabel} goal favors volume — you've banked ${vol} on ${card.name}.`);
      } else if (primaryGoal === 'endurance') {
        lines.push(
          `Your ${goalLabel} goal: build ${card.name} capacity with controlled tempo and shorter rest between sets.`,
        );
      } else {
        lines.push(`Aligned with your ${goalLabel} goal — keep ${card.name} technique sharp before adding load or reps.`);
      }
    }

    if (stats.improvementPct30d != null && stats.improvementPct30d !== 0) {
      const dir = stats.improvementPct30d > 0 ? 'improved' : 'dropped';
      const metric = weighted ? 'estimated strength' : 'top-set reps';
      lines.push(`Your ${card.name} ${metric} ${dir} ${Math.abs(stats.improvementPct30d)}% over the last 30 days.`);
    }

    if (stats.improvementPct30d != null && stats.improvementPct30d < -5) {
      lines.push(
        `Recovery note: performance dipped this month — consider a lighter ${card.name} week before pushing intensity again.`,
      );
    }

    if (stats.stickingPointRep != null) {
      lines.push(`Sets tend to stall around rep ${stats.stickingPointRep} — that's your current sticking point on ${card.name}.`);
    }

    if (weighted && stats.currentTopWeightKg) {
      lines.push('Next step: take the last working set to technical failure, then add a back-off set at ~80% load.');
    } else if (stats.stickingPointRep != null) {
      lines.push(`Next step: add one AMRAP set after your final working set to break past rep ${stats.stickingPointRep}.`);
    }

    if (stats.totalSessions < 3) {
      lines.push(`${stats.totalSessions} session${stats.totalSessions === 1 ? '' : 's'} logged — a few more unlocks sharper ${card.name} trends.`);
    }
  } else {
    if (primaryGoal) {
      lines.push(
        `With your ${getTrainingGoalLabel(primaryGoal)} goal, log a few ${card.name} sessions to get a tailored progression plan.`,
      );
    } else {
      lines.push(`Log a few ${card.name} sessions and your coach will surface strength trends, sticking points, and a tailored plan.`);
    }
  }

  return (
    <Card glow>
      <View style={styles.coachHeader}>
        <AppText variant="headline">✦</AppText>
        <AppText variant="bodyBold">Coach insight</AppText>
      </View>
      <View style={styles.coachLines}>
        {lines.map((line, i) => (
          <AppText key={i} variant="body" color="textSecondary">
            {line}
          </AppText>
        ))}
      </View>
    </Card>
  );
}

function ExerciseRefList({
  slugs,
  currentName,
  showEquipment,
}: {
  slugs: string[];
  currentName: string;
  showEquipment?: boolean;
}) {
  return (
    <View style={styles.refList}>
      {slugs.map((slug) => {
        const ref = refOf(slug);
        return (
          <Pressable
            key={slug}
            onPress={() =>
              router.push({ pathname: '/(features)/exercise/[id]', params: { id: slug, name: ref.name } })
            }
            accessibilityRole="button">
            <Card style={styles.refCard}>
              <View style={styles.refText}>
                <AppText variant="bodyBold">{ref.name}</AppText>
                {showEquipment && ref.equipment ? (
                  <AppText variant="caption" color="textTertiary">
                    {ref.equipment}
                  </AppText>
                ) : ref.bodyArea ? (
                  <AppText variant="caption" color="textTertiary">
                    {ref.bodyArea}
                  </AppText>
                ) : (
                  <AppText variant="caption" color="textTertiary">
                    Swap for {currentName}
                  </AppText>
                )}
              </View>
              <AppText variant="body" color="primary">
                ›
              </AppText>
            </Card>
          </Pressable>
        );
      })}
    </View>
  );
}

// ───────────────────────── Primitives ─────────────────────────

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={[styles.statTile, accent && styles.statTileAccent]}>
      <AppText variant="label" color="textTertiary">
        {label}
      </AppText>
      <AppText variant="headline" color={accent ? 'primary' : 'textPrimary'}>
        {value}
      </AppText>
    </View>
  );
}

function BulletList({
  items,
  tone,
  symbol = '•',
}: {
  items: string[];
  tone: 'primary' | 'error';
  symbol?: string;
}) {
  return (
    <View style={styles.bulletList}>
      {items.slice(0, 5).map((item, i) => (
        <View key={i} style={styles.bulletRow}>
          <AppText variant="bodyBold" color={tone}>
            {symbol}
          </AppText>
          <AppText variant="body" style={styles.bulletText}>
            {item}
          </AppText>
        </View>
      ))}
    </View>
  );
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return value;
  }
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSection: {
    marginBottom: Spacing.xxl,
  },
  section: {
    marginBottom: Spacing.xxl,
  },
  feelRow: {
    flexDirection: 'row',
    gap: Spacing.xxl,
  },
  feelBlock: {
    gap: Spacing.xs,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  statTile: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: LiftFlowColors.surface,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  statTileAccent: {
    borderColor: LiftFlowColors.primary,
    backgroundColor: LiftFlowColors.primaryGlow,
  },
  progressionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  progressionCol: {
    gap: Spacing.xs,
  },
  recommendation: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: LiftFlowColors.border,
    gap: Spacing.xs,
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  sessionList: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  coachHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  coachLines: {
    gap: Spacing.sm,
  },
  refList: {
    gap: Spacing.sm,
  },
  refCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  refText: {
    gap: 2,
  },
  bulletList: {
    gap: Spacing.md,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  bulletText: {
    flex: 1,
  },
});
