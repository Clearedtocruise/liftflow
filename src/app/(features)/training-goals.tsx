import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { GoalPicker } from '@/components/goals/GoalPicker';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { AppText } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';
import { summarizeGoals, type TrainingGoalId } from '@/constants/trainingGoals';
import { useAuth } from '@/hooks/useAuth';
import { buildGoalsProfilePayload } from '@/lib/trainingGoalsProfile';
import { userService } from '@/services/userService';

export default function TrainingGoalsScreen() {
  const { user, refreshProfile } = useAuth();
  const [rankedGoals, setRankedGoals] = useState<TrainingGoalId[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const goals = (user.fitnessGoals?.length ? user.fitnessGoals : user.primaryTrainingGoal ? [user.primaryTrainingGoal] : []) as TrainingGoalId[];
    setRankedGoals(goals);
    setLoading(false);
  }, [user]);

  const save = useCallback(async () => {
    if (!user) return;
    if (rankedGoals.length === 0) {
      Alert.alert('Select goals', 'Choose at least one training goal.');
      return;
    }

    setSaving(true);
    const result = await userService.updateProfile(user.id, buildGoalsProfilePayload(rankedGoals));
    setSaving(false);

    if (!result.success) {
      Alert.alert('Could not save', result.error);
      return;
    }

    await refreshProfile();
    Alert.alert('Saved', 'Training goals updated.');
    router.back();
  }, [user, rankedGoals, refreshProfile]);

  return (
    <ScreenContainer>
      <SectionHeader
        title="Training goals"
        subtitle="Select multiple goals and rank them. Your top goal sets nutrition targets; others shape your workouts."
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {loading ? (
          <AppText variant="body" color="textSecondary">
            Loading…
          </AppText>
        ) : (
          <GoalPicker rankedGoals={rankedGoals} onChange={setRankedGoals} disabled={saving} />
        )}

        {rankedGoals.length > 0 ? (
          <AppText variant="caption" color="textSecondary">
            {summarizeGoals(rankedGoals)}
          </AppText>
        ) : null}

        <View style={styles.actions}>
          <PrimaryButton label={saving ? 'Saving…' : 'Save goals'} loading={saving} disabled={saving} onPress={save} />
          <PrimaryButton label="Cancel" variant="ghost" disabled={saving} onPress={() => router.back()} />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  actions: {
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
});
