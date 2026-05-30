import type { UserProfile } from '@/types/user';
import type { WorkoutLocation } from '@/types/workoutLocation';

export const TRAINING_LOCATIONS = [
  { id: 'home_gym', label: 'Home gym' },
  { id: 'commercial_gym', label: 'Commercial gym' },
] as const;

export const EQUIPMENT_OPTIONS = [
  { id: 'bodyweight', label: 'Bodyweight' },
  { id: 'bands', label: 'Bands' },
  { id: 'dumbbells', label: 'Dumbbells' },
  { id: 'bench', label: 'Bench' },
  { id: 'pull_up_bar', label: 'Pull-up bar' },
  { id: 'barbell', label: 'Barbell' },
  { id: 'rack', label: 'Rack' },
  { id: 'machines', label: 'Machines' },
  { id: 'full_gym', label: 'Full gym' },
] as const;

export const TRAINING_GOALS = [
  { id: 'fat_loss', label: 'Fat loss' },
  { id: 'muscle_gain', label: 'Muscle gain' },
  { id: 'strength', label: 'Strength' },
  { id: 'general_fitness', label: 'General fitness' },
] as const;

export type TrainingLocationId = (typeof TRAINING_LOCATIONS)[number]['id'];
export type EquipmentId = (typeof EQUIPMENT_OPTIONS)[number]['id'];
export type TrainingGoalId = (typeof TRAINING_GOALS)[number]['id'];

/** Commercial gym preset — user can still deselect items. */
export const COMMERCIAL_GYM_EQUIPMENT: EquipmentId[] = [
  'full_gym',
];

export const HOME_GYM_STARTER: EquipmentId[] = ['bodyweight', 'dumbbells', 'bench'];

/** Display label for workout start prompts (named gym → location type fallback). */
export function getPrimaryGymLabel(profile: Pick<UserProfile, 'primaryGymName' | 'trainingLocation'>): string | null {
  const name = profile.primaryGymName?.trim();
  if (name) return name;
  if (profile.trainingLocation === 'commercial_gym') return 'Commercial Gym';
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
