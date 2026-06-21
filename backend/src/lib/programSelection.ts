import type { ProgramFrequency, ProgramType } from './programTypes.js';

export type ProgramSelectionInput = {
  fitnessGoals?: string[];
  primaryGoal?: string;
  experience?: string;
  daysPerWeek?: number;
  timeline?: 'aggressive' | 'moderate' | 'conservative';
};

export function inferProgramType(input: ProgramSelectionInput): ProgramType {
  const goals = input.fitnessGoals ?? [];
  const primary = input.primaryGoal ?? goals[0] ?? 'general_fitness';
  const days = input.daysPerWeek ?? 4;

  if (primary === 'strength' || goals.includes('strength')) return 'strength';
  if (days <= 3) return 'body_part_split';
  if (primary === 'muscle_gain' || primary === 'hypertrophy' || goals.includes('muscle_gain')) {
    return 'body_part_split';
  }
  if (goals.length >= 2) return 'body_part_split';
  if (days >= 4 && days <= 7) return 'body_part_split';
  if (primary === 'fat_loss' || primary === 'weight_loss') return 'upper_lower';

  return 'body_part_split';
}

export function resolveDaysPerWeekFromProfile(input: {
  coachProfileDays?: number;
  programFrequency?: number | string;
  coachActivationFrequency?: number;
}): number {
  if (input.coachProfileDays != null && input.coachProfileDays >= 3 && input.coachProfileDays <= 7) {
    return input.coachProfileDays;
  }
  if (typeof input.programFrequency === 'number' && input.programFrequency >= 3 && input.programFrequency <= 7) {
    return input.programFrequency;
  }
  if (
    input.coachActivationFrequency != null &&
    input.coachActivationFrequency >= 3 &&
    input.coachActivationFrequency <= 7
  ) {
    return input.coachActivationFrequency;
  }
  return 4;
}

export function inferProgramFrequency(input: ProgramSelectionInput): ProgramFrequency {
  const days = resolveDaysPerWeekFromProfile({
    coachProfileDays: input.daysPerWeek,
  });
  if (days >= 3 && days <= 7) return days as ProgramFrequency;
  return 4;
}

export function inferNutritionGoal(primaryGoal?: string, fitnessGoals?: string[]): string {
  const ranked = fitnessGoals?.length ? fitnessGoals : primaryGoal ? [primaryGoal] : ['general_fitness'];
  const first = ranked[0];
  if (first === 'fat_loss' || first === 'weight_loss') return 'fat_loss';
  if (first === 'muscle_gain' || first === 'hypertrophy') return 'muscle_gain';
  if (first === 'strength') return 'strength';
  return 'general_fitness';
}
