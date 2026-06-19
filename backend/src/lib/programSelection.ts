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

  if (primary === 'strength' || goals.includes('strength')) return 'strength';
  if (goals.length >= 3) return 'body_part_split';

  const days = input.daysPerWeek ?? 4;
  if (days <= 3) return 'body_part_split';
  if (primary === 'fat_loss' || primary === 'weight_loss') return 'upper_lower';
  if (primary === 'muscle_gain' || primary === 'hypertrophy') return 'body_part_split';

  return days >= 5 ? 'body_part_split' : 'upper_lower';
}

export function inferProgramFrequency(input: ProgramSelectionInput): ProgramFrequency {
  const days = input.daysPerWeek ?? 4;
  if (days >= 3 && days <= 6) return days as ProgramFrequency;
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
