import {
    formatWorkoutWeightForInput,
    normalizeVoiceWeightToKg,
    type WeightUnit,
} from '@/lib/unitConversion';
import type { ParsedVoiceCommand } from '@/types';

export type VoiceSetDraft = {
  id: string;
  exerciseName?: string;
  weight?: string;
  reps?: string;
  weightKg?: number;
  repsValue?: number;
};

export function buildVoiceSetDraft(
  command: ParsedVoiceCommand,
  preferredWeightUnit: WeightUnit,
): VoiceSetDraft {
  const weightKg =
    command.weight != null
      ? normalizeVoiceWeightToKg(command.weight, command.rawText, preferredWeightUnit)
      : undefined;

  return {
    id: `${Date.now()}-${command.rawText}`,
    exerciseName: command.exercise,
    weight:
      weightKg != null ? formatWorkoutWeightForInput(weightKg, preferredWeightUnit) : undefined,
    reps: command.reps != null ? String(command.reps) : undefined,
    weightKg,
    repsValue: command.reps,
  };
}
