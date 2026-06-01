import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ChipGrid, SelectableChip } from '@/components/onboarding/SelectableChip';
import { AppText } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';
import {
    DISTANCE_UNIT_OPTIONS,
    HEIGHT_UNIT_OPTIONS,
    MEASUREMENT_UNIT_OPTIONS,
    type UnitPreferences,
    WATER_UNIT_OPTIONS,
    WEIGHT_UNIT_OPTIONS,
} from '@/constants/units';

type UnitPreferencesPickerProps = {
  value: UnitPreferences;
  onChange: (next: UnitPreferences) => void;
  disabled?: boolean;
};

function UnitSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <AppText variant="subhead" color="textSecondary">
        {title}
      </AppText>
      <ChipGrid>{children}</ChipGrid>
    </View>
  );
}

export function UnitPreferencesPicker({ value, onChange, disabled }: UnitPreferencesPickerProps) {
  return (
    <View style={styles.container}>
      <UnitSection title="Height">
        {HEIGHT_UNIT_OPTIONS.map((opt) => (
          <SelectableChip
            key={opt.id}
            label={opt.label}
            selected={value.preferredHeightUnit === opt.id}
            onPress={() => !disabled && onChange({ ...value, preferredHeightUnit: opt.id })}
          />
        ))}
      </UnitSection>

      <UnitSection title="Weight">
        {WEIGHT_UNIT_OPTIONS.map((opt) => (
          <SelectableChip
            key={opt.id}
            label={opt.label}
            selected={value.preferredWeightUnit === opt.id}
            onPress={() => !disabled && onChange({ ...value, preferredWeightUnit: opt.id })}
          />
        ))}
      </UnitSection>

      <UnitSection title="Distance">
        {DISTANCE_UNIT_OPTIONS.map((opt) => (
          <SelectableChip
            key={opt.id}
            label={opt.label}
            selected={value.preferredDistanceUnit === opt.id}
            onPress={() => !disabled && onChange({ ...value, preferredDistanceUnit: opt.id })}
          />
        ))}
      </UnitSection>

      <UnitSection title="Body measurements">
        {MEASUREMENT_UNIT_OPTIONS.map((opt) => (
          <SelectableChip
            key={opt.id}
            label={opt.label}
            selected={value.preferredMeasurementUnit === opt.id}
            onPress={() => !disabled && onChange({ ...value, preferredMeasurementUnit: opt.id })}
          />
        ))}
      </UnitSection>

      <UnitSection title="Water intake">
        {WATER_UNIT_OPTIONS.map((opt) => (
          <SelectableChip
            key={opt.id}
            label={opt.label}
            selected={value.preferredWaterUnit === opt.id}
            onPress={() => !disabled && onChange({ ...value, preferredWaterUnit: opt.id })}
          />
        ))}
      </UnitSection>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xl,
  },
  section: {
    gap: Spacing.md,
  },
});
