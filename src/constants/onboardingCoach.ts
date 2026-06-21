import type { EquipmentPresetId } from '@/constants/equipmentCatalog';

export const GYM_PROFILES = [
  { id: 'home_gym', label: 'Home Gym', preset: 'home_gym' as EquipmentPresetId },
  { id: 'garage_gym', label: 'Garage Gym', preset: 'garage_gym' as EquipmentPresetId },
  { id: 'planet_fitness', label: 'Planet Fitness', preset: 'planet_fitness' as EquipmentPresetId },
  { id: 'commercial_gym', label: 'Commercial Gym', preset: 'commercial_gym' as EquipmentPresetId },
  { id: 'full_gym', label: 'Full Gym', preset: 'full_gym' as EquipmentPresetId },
] as const;

export type GymProfileId = (typeof GYM_PROFILES)[number]['id'];

export const TIMELINE_OPTIONS = [
  { id: 'aggressive', label: 'Aggressive', description: 'Faster results — tighter nutrition & higher training load' },
  { id: 'moderate', label: 'Moderate', description: 'Balanced pace — sustainable progress' },
  { id: 'conservative', label: 'Conservative', description: 'Gradual changes — focus on consistency' },
] as const;

export type TimelineId = (typeof TIMELINE_OPTIONS)[number]['id'];

export const DAYS_PER_WEEK_OPTIONS = [3, 4, 5, 6, 7] as const;

export const WORKOUT_DURATION_OPTIONS = [30, 45, 60, 75, 90] as const;

export const WEEKDAY_OPTIONS = [
  { id: 'monday', label: 'Mon' },
  { id: 'tuesday', label: 'Tue' },
  { id: 'wednesday', label: 'Wed' },
  { id: 'thursday', label: 'Thu' },
  { id: 'friday', label: 'Fri' },
  { id: 'saturday', label: 'Sat' },
  { id: 'sunday', label: 'Sun' },
] as const;

export const WORKOUT_TIME_OPTIONS = [
  { id: 'early_morning', label: 'Early morning (5–8 AM)' },
  { id: 'morning', label: 'Morning (8–11 AM)' },
  { id: 'midday', label: 'Midday (11 AM–2 PM)' },
  { id: 'afternoon', label: 'Afternoon (2–5 PM)' },
  { id: 'evening', label: 'Evening (5–8 PM)' },
  { id: 'night', label: 'Night (8 PM+)' },
] as const;

export const SEX_OPTIONS = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
  { id: 'other', label: 'Other' },
  { id: 'prefer_not_to_say', label: 'Prefer not to say' },
] as const;

export const MEALS_PER_DAY_OPTIONS = [3, 4, 5, 6] as const;

export const DIETARY_RESTRICTION_OPTIONS = [
  'Vegetarian',
  'Vegan',
  'Gluten-free',
  'Dairy-free',
  'Nut allergy',
  'Halal',
  'Kosher',
  'Low carb',
  'Keto',
] as const;

export const FOOD_PREFERENCE_OPTIONS = [
  'Chicken',
  'Beef',
  'Fish',
  'Eggs',
  'Greek yogurt',
  'Rice',
  'Potatoes',
  'Pasta',
  'Salads',
  'Smoothies',
] as const;

export const SUPPLEMENT_OPTIONS = [
  'Whey protein',
  'Creatine',
  'Pre-workout',
  'Fish oil',
  'Multivitamin',
  'Electrolytes',
  'BCAAs',
  'Vitamin D',
] as const;

export const LIMITATION_BODY_AREAS = [
  'Shoulder',
  'Lower back',
  'Knee',
  'Hip',
  'Elbow',
  'Wrist',
  'Ankle',
  'Neck',
] as const;

export type CoachProfileMetadata = {
  age?: number;
  goalWeightKg?: number;
  timeline?: TimelineId;
  daysPerWeek?: number;
  minutesPerWorkout?: number;
  preferredWorkoutDays?: string[];
  preferredWorkoutTimes?: string[];
  mealsPerDay?: number;
  foodPreferences?: string[];
  dietaryRestrictions?: string[];
  currentSupplements?: string[];
  limitationNotes?: string;
  exercisesToAvoid?: string[];
};
