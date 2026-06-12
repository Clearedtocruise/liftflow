import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { getPrimaryGymLabel, TRAINING_LOCATIONS } from '@/constants/trainingProfile';
import type { NearbyWorkoutLocationMatch } from '@/services/deviceLocationService';
import type { UserProfile } from '@/types/user';
import type { WorkoutLocation } from '@/types/workoutLocation';

type StartWorkoutPromptProps = {
  user: UserProfile | null;
  locations: WorkoutLocation[];
  selectedLocationId: string | null;
  onSelectLocation: (id: string) => void;
  loading?: boolean;
  locationsLoading?: boolean;
  onStart: () => void;
  onAddLocation?: () => void;
  onNotNow?: () => void;
  nearbyMatch?: NearbyWorkoutLocationMatch | null;
  locationChecking?: boolean;
  onEnableLocation?: () => void;
  hideStartButton?: boolean;
};

function locationTypeLabel(type: WorkoutLocation['locationType']): string {
  return TRAINING_LOCATIONS.find((t) => t.id === type)?.label ?? type;
}

export function StartWorkoutPrompt({
  user,
  locations,
  selectedLocationId,
  onSelectLocation,
  loading,
  locationsLoading,
  onStart,
  onAddLocation,
  onNotNow,
  nearbyMatch,
  locationChecking,
  onEnableLocation,
  hideStartButton,
}: StartWorkoutPromptProps) {
  const legacyLabel = user ? getPrimaryGymLabel(user) : null;
  const selected = locations.find((l) => l.id === selectedLocationId) ?? locations[0];

  return (
    <Card style={styles.card}>
      <AppText variant="headline" style={styles.question}>
        {hideStartButton ? 'Training location' : 'Are you starting a workout?'}
      </AppText>

      {locationChecking ? (
        <AppText variant="footnote" color="textSecondary">
          Checking if you are at a saved gym…
        </AppText>
      ) : null}

      {nearbyMatch ? (
        <View style={styles.nearbyBanner}>
          <AppText variant="bodyBold" color="accent">
            You are at {nearbyMatch.location.name}
          </AppText>
          <AppText variant="caption" color="textSecondary">
            About {nearbyMatch.distanceMeters} m away · detected via GPS
          </AppText>
        </View>
      ) : onEnableLocation ? (
        <AppText variant="footnote" color="textSecondary">
          Enable location access to auto-select your gym when you arrive.
        </AppText>
      ) : null}

      {locationsLoading ? (
        <AppText variant="body" color="textSecondary">
          Loading your gyms…
        </AppText>
      ) : locations.length > 0 ? (
        <>
          <AppText variant="body" color="textSecondary">
            Where are you training today?
          </AppText>
          <View style={styles.locationList}>
            {locations.map((loc) => {
              const active = loc.id === (selectedLocationId ?? selected?.id);
              return (
                <Pressable
                  key={loc.id}
                  onPress={() => onSelectLocation(loc.id)}
                  style={[styles.locationChip, active && styles.locationChipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}>
                  <AppText variant="bodyBold" color={active ? 'background' : 'textPrimary'}>
                    {loc.name}
                  </AppText>
                  <AppText variant="caption" color={active ? 'background' : 'textSecondary'}>
                    {locationTypeLabel(loc.locationType)}
                    {loc.isDefault ? ' · Default' : ''}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : legacyLabel ? (
        <AppText variant="body" color="textSecondary" style={styles.gym}>
          Primary location: {legacyLabel}
        </AppText>
      ) : (
        <AppText variant="body" color="textSecondary" style={styles.gym}>
          Add workout locations in Settings to pick your gym each session.
        </AppText>
      )}

      <View style={styles.actions}>
        {!hideStartButton ? (
          <PrimaryButton
            label={loading ? 'Starting…' : 'Yes, start workout'}
            size="large"
            loading={loading}
            disabled={locations.length > 0 && !selectedLocationId && !selected}
            onPress={onStart}
          />
        ) : null}
        {onEnableLocation ? (
          <PrimaryButton label="Enable location access" variant="secondary" onPress={onEnableLocation} />
        ) : null}
        {onAddLocation ? (
          <PrimaryButton label="Manage locations" variant="secondary" onPress={onAddLocation} />
        ) : null}
        {onNotNow ? (
          <PrimaryButton label="Not now" variant="ghost" disabled={loading} onPress={onNotNow} />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.md,
    borderColor: LiftFlowColors.accent,
    borderWidth: StyleSheet.hairlineWidth,
  },
  question: {
    marginBottom: Spacing.xs,
  },
  nearbyBanner: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.accentGlow,
    gap: Spacing.xs,
  },
  gym: {
    lineHeight: 22,
  },
  locationList: {
    gap: Spacing.sm,
  },
  locationChip: {
    minHeight: TouchTarget.min,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.border,
    gap: Spacing.xs,
  },
  locationChipActive: {
    backgroundColor: LiftFlowColors.accent,
    borderColor: LiftFlowColors.accent,
  },
  actions: {
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
});
