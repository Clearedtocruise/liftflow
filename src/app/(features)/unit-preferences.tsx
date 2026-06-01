import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { UnitPreferencesPicker } from '@/components/settings/UnitPreferencesPicker';
import { AppText } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';
import { DEFAULT_UNIT_PREFERENCES, type UnitPreferences } from '@/constants/units';
import { useAuth } from '@/hooks/useAuth';
import { preferredUnitsFromGranular, resolveUnitPreferences } from '@/lib/unitConversion';
import { userService } from '@/services/userService';

export default function UnitPreferencesScreen() {
  const { user, refreshProfile } = useAuth();
  const [prefs, setPrefs] = useState<UnitPreferences>(DEFAULT_UNIT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setPrefs(resolveUnitPreferences(user));
    setLoading(false);
  }, [user]);

  const save = useCallback(async () => {
    if (!user) return;

    setSaving(true);
    const result = await userService.updateProfile(user.id, {
      ...prefs,
      preferredUnits: preferredUnitsFromGranular(prefs),
    });
    setSaving(false);

    if (!result.success) {
      Alert.alert('Could not save', result.error);
      return;
    }

    await refreshProfile();
    Alert.alert('Saved', 'Unit preferences updated.');
    router.back();
  }, [user, prefs, refreshProfile]);

  return (
    <ScreenContainer>
      <SectionHeader
        title="Units"
        subtitle="Choose how measurements appear in the app. All data is stored in metric units internally."
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {loading ? (
          <AppText variant="body" color="textSecondary">
            Loading…
          </AppText>
        ) : (
          <UnitPreferencesPicker value={prefs} onChange={setPrefs} disabled={saving} />
        )}
      </ScrollView>

      <View style={styles.actions}>
        <PrimaryButton label="Save" onPress={save} loading={saving} disabled={loading} />
        <PrimaryButton label="Cancel" variant="secondary" onPress={() => router.back()} disabled={saving} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: Spacing.xxxl,
  },
  actions: {
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
});
