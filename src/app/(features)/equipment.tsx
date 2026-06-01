import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { EquipmentPicker } from '@/components/equipment/EquipmentPicker';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { AppText } from '@/components/ui/AppText';
import { summarizeEquipment, type EquipmentId } from '@/constants/equipmentCatalog';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { userService } from '@/services/userService';
import { workoutLocationService } from '@/services/workoutLocationService';

export default function EquipmentScreen() {
  const { user, refreshProfile } = useAuth();
  const [selected, setSelected] = useState<EquipmentId[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setSelected(user.availableEquipment ?? []);
    setLoading(false);
  }, [user]);

  const save = useCallback(async () => {
    if (!user) return;
    if (selected.length === 0) {
      Alert.alert('Select equipment', 'Choose at least one item or apply a preset.');
      return;
    }

    setSaving(true);
    const profileResult = await userService.updateProfile(user.id, {
      availableEquipment: selected,
    });
    if (!profileResult.success) {
      setSaving(false);
      Alert.alert('Could not save', profileResult.error);
      return;
    }

    const locations = await workoutLocationService.list(user.id);
    if (locations.success) {
      const defaultLoc = locations.data.find((l) => l.isDefault) ?? locations.data[0];
      if (defaultLoc) {
        await workoutLocationService.update(defaultLoc.id, user.id, {
          availableEquipment: selected,
        });
      }
    }

    await refreshProfile();
    setSaving(false);
    Alert.alert('Saved', 'Equipment preferences updated. Workout recommendations will match your selection.');
    router.back();
  }, [user, selected, refreshProfile]);

  return (
    <ScreenContainer>
      <SectionHeader
        title="Gym equipment"
        subtitle="Select everything available where you train. Programs only include exercises you can perform."
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {loading ? (
          <AppText variant="body" color="textSecondary">
            Loading…
          </AppText>
        ) : (
          <EquipmentPicker selected={selected} onChange={(next) => setSelected(next as EquipmentId[])} disabled={saving} />
        )}

        {!loading && selected.length > 0 ? (
          <AppText variant="caption" color="textSecondary">
            Summary: {summarizeEquipment(selected)}
          </AppText>
        ) : null}

        <View style={styles.actions}>
          <PrimaryButton label={saving ? 'Saving…' : 'Save equipment'} loading={saving} disabled={saving} onPress={save} />
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
