import type { UserProfile } from '@/types/user';
import type { WorkoutLocation } from '@/types/workoutLocation';

export {
    COMMERCIAL_GYM_EQUIPMENT,
    EQUIPMENT_OPTIONS,
    EQUIPMENT_PRESETS,
    HOME_GYM_STARTER,
    summarizeEquipment
} from '@/constants/equipmentCatalog';
export type { EquipmentId, EquipmentPresetId } from '@/constants/equipmentCatalog';
export { summarizeGoals, toNutritionGoal, TRAINING_GOAL_OPTIONS, type TrainingGoalId } from '@/constants/trainingGoals';

export const TRAINING_LOCATIONS = [
  { id: 'home_gym', label: 'Home Gym' },
  { id: 'garage_gym', label: 'Garage Gym' },
  { id: 'planet_fitness', label: 'Planet Fitness' },
  { id: 'commercial_gym', label: 'Commercial Gym' },
  { id: 'full_gym', label: 'Full Gym' },
] as const;

/** @deprecated Use TRAINING_GOAL_OPTIONS from trainingGoals */
export const TRAINING_GOALS = [
  { id: 'fat_loss', label: 'Fat loss' },
  { id: 'muscle_gain', label: 'Muscle gain' },
  { id: 'strength', label: 'Strength' },
  { id: 'general_fitness', label: 'General fitness' },
] as const;

export type TrainingLocationId = (typeof TRAINING_LOCATIONS)[number]['id'];

export function getPrimaryGymLabel(profile: Pick<UserProfile, 'primaryGymName' | 'trainingLocation'>): string | null {
  const name = profile.primaryGymName?.trim();
  if (name) return name;
  if (profile.trainingLocation === 'commercial_gym') return 'Commercial Gym';
  if (profile.trainingLocation === 'planet_fitness') return 'Planet Fitness';
  if (profile.trainingLocation === 'garage_gym') return 'Garage Gym';
  if (profile.trainingLocation === 'full_gym') return 'Full Gym';
  if (profile.trainingLocation === 'home_gym') return 'Home Gym';
  return null;
}

export function getLocationLabel(location: WorkoutLocation): string {
  return location.name.trim();
}

export function buildWorkoutSessionNameFromLocation(location: WorkoutLocation): string {
  return `Workout at ${getLocationLabel(location)}`;
}

export function buildWorkoutSessionName(
  profile: Pick<UserProfile, 'primaryGymName' | 'trainingLocation'>,
  location?: WorkoutLocation | null,
): string {
  if (location) return buildWorkoutSessionNameFromLocation(location);
  const gym = getPrimaryGymLabel(profile);
  return gym ? `Workout at ${gym}` : 'Workout';
}

export function pickDefaultLocation(locations: WorkoutLocation[], preferredId?: string | null): WorkoutLocation | null {
  if (locations.length === 0) return null;
  if (preferredId) {
    const found = locations.find((l) => l.id === preferredId);
    if (found) return found;
  }
  return locations.find((l) => l.isDefault) ?? locations[0];
}
