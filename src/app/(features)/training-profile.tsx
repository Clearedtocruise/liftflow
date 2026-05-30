import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { TextField } from '@/components/layout/TextField';
import { ChipGrid, SelectableChip } from '@/components/onboarding/SelectableChip';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing, TouchTarget } from '@/constants/theme';
import {
    COMMERCIAL_GYM_EQUIPMENT,
    HOME_GYM_STARTER,
    TRAINING_LOCATIONS,
    type EquipmentId,
    type TrainingLocationId,
} from '@/constants/trainingProfile';
import { useAuth } from '@/hooks/useAuth';
import { defaultRadiusForLocationType } from '@/lib/geo';
import { deviceLocationService } from '@/services/deviceLocationService';
import { workoutLocationService } from '@/services/workoutLocationService';
import type { WorkoutLocation } from '@/types/workoutLocation';

export default function TrainingProfileScreen() {
  const { user } = useAuth();
  const [locations, setLocations] = useState<WorkoutLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [locationType, setLocationType] = useState<TrainingLocationId>('commercial_gym');
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [capturingGps, setCapturingGps] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const result = await workoutLocationService.list(user.id);
    if (result.success) setLocations(result.data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setName('');
    setLocationType('commercial_gym');
    setSetAsDefault(false);
    setPendingCoords(null);
  }

  async function captureCurrentGps() {
    setCapturingGps(true);
    const result = await deviceLocationService.getCurrentPosition();
    setCapturingGps(false);
    if (result.success) {
      setPendingCoords(result.data);
      Alert.alert('Location saved', 'GPS coordinates will be saved with this gym.');
    } else {
      Alert.alert('Location unavailable', result.error);
    }
  }

  function openAdd() {
    setEditingId(null);
    setName('');
    setLocationType('commercial_gym');
    setSetAsDefault(locations.length === 0);
    setShowForm(true);
  }

  function openEdit(loc: WorkoutLocation) {
    setEditingId(loc.id);
    setName(loc.name);
    setLocationType(loc.locationType);
    setSetAsDefault(loc.isDefault);
    setPendingCoords(
      loc.latitude != null && loc.longitude != null
        ? { latitude: loc.latitude, longitude: loc.longitude }
        : null,
    );
    setShowForm(true);
  }

  const saveLocation = useCallback(async () => {
    if (!user || !name.trim()) {
      Alert.alert('Name required', 'Enter a name for this gym or training spot.');
      return;
    }
    setSaving(true);
    const equipment: EquipmentId[] =
      locationType === 'commercial_gym' ? [...COMMERCIAL_GYM_EQUIPMENT] : [...HOME_GYM_STARTER];

    const coordPayload = pendingCoords
      ? {
          latitude: pendingCoords.latitude,
          longitude: pendingCoords.longitude,
          radiusMeters: defaultRadiusForLocationType(locationType),
        }
      : {};

    const result = editingId
      ? await workoutLocationService.update(editingId, user.id, {
          name: name.trim(),
          locationType,
          availableEquipment: equipment,
          isDefault: setAsDefault,
          ...coordPayload,
        })
      : await workoutLocationService.create(user.id, {
          name: name.trim(),
          locationType,
          availableEquipment: equipment,
          isDefault: setAsDefault || locations.length === 0,
          ...coordPayload,
        });

    setSaving(false);
    if (!result.success) {
      Alert.alert('Could not save', result.error);
      return;
    }
    resetForm();
    load();
  }, [user, name, locationType, setAsDefault, editingId, locations.length, load]);

  async function handleDelete(loc: WorkoutLocation) {
    if (!user) return;
    Alert.alert('Remove location', `Delete "${loc.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const result = await workoutLocationService.remove(loc.id, user.id);
          if (result.success) load();
          else Alert.alert('Error', result.error);
        },
      },
    ]);
  }

  async function handleSetDefault(loc: WorkoutLocation) {
    if (!user) return;
    const result = await workoutLocationService.setDefault(loc.id, user.id);
    if (result.success) load();
    else Alert.alert('Error', result.error);
  }

  return (
    <ScreenContainer>
      <SectionHeader
        title="Workout locations"
        subtitle="Add every gym or home setup you use. Pick one when you start a workout."
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {loading ? (
          <AppText variant="body" color="textSecondary">
            Loading…
          </AppText>
        ) : (
          <View style={styles.list}>
            {locations.map((loc) => (
              <Card key={loc.id} style={styles.locCard}>
                <View style={styles.locHeader}>
                  <View style={styles.locTitle}>
                    <AppText variant="bodyBold">{loc.name}</AppText>
                    <AppText variant="caption" color="textSecondary">
                      {TRAINING_LOCATIONS.find((t) => t.id === loc.locationType)?.label}
                      {loc.isDefault ? ' · Default' : ''}
                      {loc.latitude != null ? ' · GPS saved' : ' · No GPS'}
                    </AppText>
                  </View>
                </View>
                <View style={styles.locActions}>
                  {!loc.isDefault ? (
                    <Pressable onPress={() => handleSetDefault(loc)} style={styles.linkBtn}>
                      <AppText variant="caption" color="accent">
                        Set default
                      </AppText>
                    </Pressable>
                  ) : null}
                  <Pressable onPress={() => openEdit(loc)} style={styles.linkBtn}>
                    <AppText variant="caption" color="accent">
                      Edit
                    </AppText>
                  </Pressable>
                  <Pressable onPress={() => handleDelete(loc)} style={styles.linkBtn}>
                    <AppText variant="caption" color="textSecondary">
                      Delete
                    </AppText>
                  </Pressable>
                </View>
              </Card>
            ))}
          </View>
        )}

        {!showForm ? (
          <PrimaryButton label="Add location" onPress={openAdd} variant="secondary" />
        ) : (
          <Card style={styles.form}>
            <AppText variant="bodyBold">{editingId ? 'Edit location' : 'New location'}</AppText>
            <TextField label="Name" placeholder="e.g. Planet Fitness, Home gym" value={name} onChangeText={setName} />
            <AppText variant="caption" color="textSecondary">
              Type
            </AppText>
            <ChipGrid>
              {TRAINING_LOCATIONS.map((opt) => (
                <SelectableChip
                  key={opt.id}
                  label={opt.label}
                  selected={locationType === opt.id}
                  onPress={() => setLocationType(opt.id)}
                />
              ))}
            </ChipGrid>
            <Pressable
              onPress={() => setSetAsDefault((v) => !v)}
              style={[styles.defaultToggle, setAsDefault && styles.defaultToggleOn]}>
              <AppText variant="body" color={setAsDefault ? 'background' : 'textPrimary'}>
                Default location
              </AppText>
            </Pressable>
            <PrimaryButton
              label={capturingGps ? 'Getting location…' : pendingCoords ? 'GPS captured ✓' : 'Use current location'}
              variant="secondary"
              loading={capturingGps}
              onPress={captureCurrentGps}
            />
            {pendingCoords ? (
              <AppText variant="footnote" color="textSecondary">
                {pendingCoords.latitude.toFixed(5)}, {pendingCoords.longitude.toFixed(5)}
              </AppText>
            ) : null}
            <PrimaryButton label={saving ? 'Saving…' : 'Save location'} loading={saving} onPress={saveLocation} />
            <PrimaryButton label="Cancel" variant="ghost" onPress={resetForm} />
          </Card>
        )}

        <PrimaryButton label="Done" onPress={() => router.back()} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  list: {
    gap: Spacing.md,
  },
  locCard: {
    gap: Spacing.sm,
  },
  locHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  locTitle: {
    flex: 1,
    gap: Spacing.xs,
  },
  locActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  linkBtn: {
    minHeight: TouchTarget.min,
    justifyContent: 'center',
  },
  form: {
    gap: Spacing.md,
  },
  defaultToggle: {
    minHeight: TouchTarget.min,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.border,
    justifyContent: 'center',
    backgroundColor: LiftFlowColors.surfaceElevated,
  },
  defaultToggleOn: {
    backgroundColor: LiftFlowColors.accent,
    borderColor: LiftFlowColors.accent,
  },
});
