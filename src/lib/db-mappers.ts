import { classifyExercise } from '@/lib/exerciseClassification';
import type {
    BodyCompositionRecord,
    Exercise,
    Goal,
    GroceryList,
    GroceryListItem,
    Meal,
    MealOrigin,
    MealPlan,
    MealStatus,
    NutritionGoals,
    ProgressPhoto,
    UserMetric,
    UserPreferences,
    UserProfile,
    WorkoutExercise,
    WorkoutHistoryItem,
    WorkoutSession,
    WorkoutSet
} from '@/types';

type ProfileRow = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  sex: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  body_fat_pct: number | null;
  training_experience: string | null;
  fitness_goals: string[] | null;
  preferred_units: string;
  preferred_height_unit?: string | null;
  preferred_weight_unit?: string | null;
  preferred_distance_unit?: string | null;
  preferred_measurement_unit?: string | null;
  preferred_water_unit?: string | null;
  confirmation_mode: string;
  timezone: string | null;
  training_location: string | null;
  primary_gym_name: string | null;
  available_equipment: string[] | null;
  primary_training_goal: string | null;
  onboarding_completed: boolean;
  is_beta_tester?: boolean | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export function mapProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    dateOfBirth: row.date_of_birth ?? undefined,
    sex: (row.sex as UserProfile['sex']) ?? undefined,
    heightCm: row.height_cm ?? undefined,
    weightKg: row.weight_kg ?? undefined,
    bodyFatPct: row.body_fat_pct ?? undefined,
    trainingExperience: (row.training_experience as UserProfile['trainingExperience']) ?? undefined,
    fitnessGoals: (row.fitness_goals ?? undefined) as UserProfile['fitnessGoals'],
    preferredUnits: row.preferred_units as UserProfile['preferredUnits'],
    preferredHeightUnit: (row.preferred_height_unit as UserProfile['preferredHeightUnit']) ?? undefined,
    preferredWeightUnit: (row.preferred_weight_unit as UserProfile['preferredWeightUnit']) ?? undefined,
    preferredDistanceUnit: (row.preferred_distance_unit as UserProfile['preferredDistanceUnit']) ?? undefined,
    preferredMeasurementUnit:
      (row.preferred_measurement_unit as UserProfile['preferredMeasurementUnit']) ?? undefined,
    preferredWaterUnit: (row.preferred_water_unit as UserProfile['preferredWaterUnit']) ?? undefined,
    confirmationMode: row.confirmation_mode as UserProfile['confirmationMode'],
    timezone: row.timezone ?? undefined,
    trainingLocation: (row.training_location as UserProfile['trainingLocation']) ?? undefined,
    primaryGymName: row.primary_gym_name ?? undefined,
    availableEquipment: (row.available_equipment ?? undefined) as UserProfile['availableEquipment'],
    primaryTrainingGoal: (row.primary_training_goal as UserProfile['primaryTrainingGoal']) ?? undefined,
    onboardingCompleted: row.onboarding_completed,
    isBetaTester: row.is_beta_tester ?? undefined,
    metadata: (row.metadata as UserProfile['metadata']) ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type PreferencesRow = {
  id: string;
  user_id: string;
  rest_timer_sound: boolean;
  rest_timer_haptics: boolean;
  voice_feedback: boolean;
  show_ads: boolean;
  share_analytics: boolean;
  printer_friendly_default: boolean;
  notification_preferences: Record<string, boolean>;
  coaching_preferences: Record<string, unknown>;
  privacy_settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export function mapPreferences(row: PreferencesRow): UserPreferences {
  return {
    id: row.id,
    userId: row.user_id,
    restTimerSound: row.rest_timer_sound,
    restTimerHaptics: row.rest_timer_haptics,
    voiceFeedback: row.voice_feedback,
    showAds: row.show_ads,
    shareAnalytics: row.share_analytics,
    printerFriendlyDefault: row.printer_friendly_default,
    notificationPreferences: row.notification_preferences ?? {},
    coachingPreferences: row.coaching_preferences ?? {},
    privacySettings: row.privacy_settings ?? {},
    createdAt: row.created_at,
  };
}

type MetricRow = {
  id: string;
  user_id: string;
  recorded_at: string;
  weight_kg: number | null;
  height_cm: number | null;
  body_fat_pct: number | null;
  muscle_mass_kg: number | null;
  resting_heart_rate: number | null;
  vo2_max: number | null;
  source: string;
  notes: string | null;
  created_at: string;
};

export function mapMetric(row: MetricRow): UserMetric {
  return {
    id: row.id,
    userId: row.user_id,
    recordedAt: row.recorded_at,
    weightKg: row.weight_kg ?? undefined,
    heightCm: row.height_cm ?? undefined,
    bodyFatPct: row.body_fat_pct ?? undefined,
    muscleMassKg: row.muscle_mass_kg ?? undefined,
    restingHeartRate: row.resting_heart_rate ?? undefined,
    vo2Max: row.vo2_max ?? undefined,
    source: row.source,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

type ExerciseRow = {
  id: string;
  name: string;
  slug: string | null;
  category: string;
  exercise_type?: string | null;
  equipment: string;
  muscle_groups: string[];
  secondary_muscles: string[] | null;
  tutorial_url: string | null;
  instructions: string | null;
  is_system: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export function mapExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug ?? undefined,
    category: row.category as Exercise['category'],
    exerciseType:
      (row.exercise_type as Exercise['exerciseType'] | undefined) ??
      classifyExercise({
        slug: row.slug,
        name: row.name,
        equipment: row.equipment,
        movementCategory: row.category,
      }),
    equipment: row.equipment,
    muscleGroups: row.muscle_groups ?? [],
    secondaryMuscles: row.secondary_muscles ?? undefined,
    tutorialUrl: row.tutorial_url ?? undefined,
    instructions: row.instructions ?? undefined,
    isSystem: row.is_system,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
  };
}

type SetRow = {
  id: string;
  workout_exercise_id: string;
  set_number: number;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  set_type: string;
  duration_seconds: number | null;
  time_under_tension_seconds: number | null;
  rest_seconds: number | null;
  is_pr: boolean | null;
  notes: string | null;
  logged_at: string;
  metadata?: Record<string, unknown> | null;
};

function readDistanceMeters(metadata: Record<string, unknown> | null | undefined): number | undefined {
  const value = metadata?.distanceMeters ?? metadata?.distance_meters;
  return typeof value === 'number' ? value : undefined;
}

export function mapSet(row: SetRow): WorkoutSet {
  return {
    id: row.id,
    workoutExerciseId: row.workout_exercise_id,
    setNumber: row.set_number,
    weight: row.weight ?? undefined,
    reps: row.reps ?? undefined,
    rpe: row.rpe ?? undefined,
    type: row.set_type as WorkoutSet['type'],
    durationSeconds: row.duration_seconds ?? undefined,
    distanceMeters: readDistanceMeters(row.metadata),
    timeUnderTensionSeconds: row.time_under_tension_seconds ?? undefined,
    restSeconds: row.rest_seconds ?? undefined,
    isPr: row.is_pr ?? undefined,
    notes: row.notes ?? undefined,
    loggedAt: row.logged_at,
    createdAt: row.logged_at,
  };
}

type WorkoutExerciseRow = {
  id: string;
  session_id: string;
  block_id: string | null;
  exercise_id: string;
  sort_order: number;
  suggested_weight: number | null;
  suggested_reps: string | null;
  notes: string | null;
  created_at: string;
  exercises?: ExerciseRow | ExerciseRow[] | null;
  workout_sets?: SetRow[] | null;
};

export function mapWorkoutExercise(row: WorkoutExerciseRow): WorkoutExercise {
  const exerciseData = Array.isArray(row.exercises) ? row.exercises[0] : row.exercises;
  return {
    id: row.id,
    sessionId: row.session_id,
    blockId: row.block_id ?? undefined,
    exerciseId: row.exercise_id,
    exercise: exerciseData ? mapExercise(exerciseData) : undefined,
    sortOrder: row.sort_order,
    suggestedWeight: row.suggested_weight ?? undefined,
    suggestedReps: row.suggested_reps ?? undefined,
    notes: row.notes ?? undefined,
    sets: (row.workout_sets ?? []).map(mapSet).sort((a, b) => a.setNumber - b.setNumber),
    createdAt: row.created_at,
  };
}

type SessionRow = {
  id: string;
  user_id: string;
  name: string;
  status: string;
  planned_workout_id: string | null;
  training_phase_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  total_volume: number | null;
  total_sets: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  workout_exercises?: WorkoutExerciseRow[] | null;
};

export function mapSession(row: SessionRow): WorkoutSession {
  const exercises = (row.workout_exercises ?? []).map(mapWorkoutExercise).sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    status: row.status as WorkoutSession['status'],
    plannedWorkoutId: row.planned_workout_id ?? undefined,
    trainingPhaseId: row.training_phase_id ?? undefined,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    durationSeconds: row.duration_seconds ?? undefined,
    totalVolume: row.total_volume ?? undefined,
    totalSets: row.total_sets ?? undefined,
    notes: row.notes ?? undefined,
    blocks: [],
    exercises,
    isActive: row.status === 'active' || row.status === 'paused',
    createdAt: row.created_at,
  };
}

type HistoryExerciseRow = {
  id: string;
  workout_sets?: Array<{ is_pr: boolean | null }> | null;
};

export function mapHistoryItem(row: SessionRow & { workout_exercises?: HistoryExerciseRow[] | null }): WorkoutHistoryItem {
  const durationMinutes = row.duration_seconds
    ? Math.round(row.duration_seconds / 60)
    : row.ended_at
      ? Math.max(1, Math.round((new Date(row.ended_at).getTime() - new Date(row.started_at).getTime()) / 60000))
      : 0;

  const prCount = (row.workout_exercises ?? []).reduce((count, exercise) => {
    return count + (exercise.workout_sets ?? []).filter((set) => set.is_pr).length;
  }, 0);

  return {
    id: row.id,
    name: row.name,
    date: row.started_at,
    durationMinutes,
    exerciseCount: row.workout_exercises?.length ?? 0,
    totalSets: row.total_sets ?? 0,
    totalVolume: row.total_volume ?? 0,
    prCount: prCount > 0 ? prCount : undefined,
    status: row.status as WorkoutHistoryItem['status'],
  };
}

type NutritionGoalsRow = {
  id: string;
  user_id: string;
  daily_calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  water_ml: number | null;
  is_active: boolean;
  effective_from: string;
  created_at: string;
};

export function mapNutritionGoals(row: NutritionGoalsRow): NutritionGoals {
  return {
    id: row.id,
    userId: row.user_id,
    dailyCalories: row.daily_calories ?? undefined,
    proteinG: row.protein_g ?? undefined,
    carbsG: row.carbs_g ?? undefined,
    fatG: row.fat_g ?? undefined,
    waterMl: row.water_ml ?? undefined,
    isActive: row.is_active,
    effectiveFrom: row.effective_from,
    createdAt: row.created_at,
  };
}

type MealRow = {
  id: string;
  meal_plan_id: string | null;
  user_id: string;
  meal_type: string;
  name: string;
  scheduled_date: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  instructions: string | null;
  created_at: string;
  status?: string | null;
  origin?: string | null;
  consumed_at?: string | null;
  client_key?: string | null;
  macros_provided?: boolean | null;
};

const MEAL_STATUSES: MealStatus[] = ['planned', 'completed', 'skipped', 'modified'];

/** Rows written before migration 029 keep their status inside the instructions JSON. */
function legacyStatus(instructions: string | null): MealStatus | null {
  if (!instructions || !instructions.trimStart().startsWith('{')) return null;
  try {
    const parsed = JSON.parse(instructions) as { status?: unknown };
    const status = parsed.status;
    return MEAL_STATUSES.find((candidate) => candidate === status) ?? null;
  } catch {
    return null;
  }
}

export function mapMeal(row: MealRow): Meal {
  const origin: MealOrigin = row.origin === 'log' || row.origin === 'plan'
    ? row.origin
    : row.meal_plan_id
      ? 'plan'
      : 'log';
  const status = MEAL_STATUSES.find((candidate) => candidate === row.status)
    ?? legacyStatus(row.instructions)
    ?? (origin === 'log' ? 'completed' : 'planned');

  return {
    id: row.id,
    mealPlanId: row.meal_plan_id ?? undefined,
    userId: row.user_id,
    mealType: row.meal_type as Meal['mealType'],
    name: row.name,
    scheduledDate: row.scheduled_date ? row.scheduled_date.slice(0, 10) : undefined,
    calories: row.calories ?? undefined,
    proteinG: row.protein_g ?? undefined,
    carbsG: row.carbs_g ?? undefined,
    fatG: row.fat_g ?? undefined,
    instructions: row.instructions ?? undefined,
    status,
    origin,
    consumedAt: row.consumed_at ?? undefined,
    clientKey: row.client_key ?? undefined,
    macrosProvided: row.macros_provided ?? row.calories != null,
    createdAt: row.created_at,
  };
}

type MealPlanRow = {
  id: string;
  user_id: string;
  name: string;
  week_start_date: string;
  ai_generated: boolean;
  ai_rationale: string | null;
  created_at: string;
  meals?: MealRow[] | null;
};

export function mapMealPlan(row: MealPlanRow): MealPlan {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    weekStartDate: row.week_start_date,
    aiGenerated: row.ai_generated,
    aiRationale: row.ai_rationale ?? undefined,
    meals: (row.meals ?? []).map(mapMeal),
    createdAt: row.created_at,
  };
}

type GroceryItemRow = {
  id: string;
  grocery_list_id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  is_checked: boolean;
  sort_order: number;
};

type GroceryListRow = {
  id: string;
  user_id: string;
  meal_plan_id: string | null;
  name: string;
  week_start_date: string | null;
  created_at: string;
  grocery_list_items?: GroceryItemRow[] | null;
};

export function mapGroceryList(row: GroceryListRow): GroceryList {
  const items: GroceryListItem[] = (row.grocery_list_items ?? [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity ?? undefined,
      unit: item.unit ?? undefined,
      category: item.category ?? undefined,
      isChecked: item.is_checked,
      sortOrder: item.sort_order,
    }));

  return {
    id: row.id,
    userId: row.user_id,
    mealPlanId: row.meal_plan_id ?? undefined,
    name: row.name,
    weekStartDate: row.week_start_date ?? undefined,
    items,
    createdAt: row.created_at,
  };
}

type BodyRow = {
  id: string;
  user_id: string;
  recorded_at: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  lean_mass_kg: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  hips_cm: number | null;
  arms_cm: number | null;
  thighs_cm: number | null;
  estimation_method: string | null;
  notes: string | null;
  created_at: string;
};

export function mapBodyRecord(row: BodyRow): BodyCompositionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    recordedAt: row.recorded_at,
    weightKg: row.weight_kg ?? undefined,
    bodyFatPct: row.body_fat_pct ?? undefined,
    leanMassKg: row.lean_mass_kg ?? undefined,
    waistCm: row.waist_cm ?? undefined,
    chestCm: row.chest_cm ?? undefined,
    hipsCm: row.hips_cm ?? undefined,
    armsCm: row.arms_cm ?? undefined,
    thighsCm: row.thighs_cm ?? undefined,
    estimationMethod: row.estimation_method ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

type PhotoRow = {
  id: string;
  user_id: string;
  photo_url: string;
  thumbnail_url: string | null;
  angle: string;
  taken_at: string;
  weight_kg: number | null;
  notes: string | null;
  is_private: boolean;
  created_at: string;
};

export function mapProgressPhoto(row: PhotoRow): ProgressPhoto {
  return {
    id: row.id,
    userId: row.user_id,
    photoUrl: row.photo_url,
    thumbnailUrl: row.thumbnail_url ?? undefined,
    angle: row.angle as ProgressPhoto['angle'],
    takenAt: row.taken_at,
    weightKg: row.weight_kg ?? undefined,
    notes: row.notes ?? undefined,
    isPrivate: row.is_private,
    createdAt: row.created_at,
  };
}

type GoalRow = {
  id: string;
  user_id: string;
  goal_type: string;
  title: string;
  description: string | null;
  target_value: number | null;
  current_value: number | null;
  unit: string | null;
  status: string;
  target_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export function mapGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    userId: row.user_id,
    goalType: row.goal_type as Goal['goalType'],
    title: row.title,
    description: row.description ?? undefined,
    targetValue: row.target_value ?? undefined,
    currentValue: row.current_value ?? undefined,
    unit: row.unit ?? undefined,
    status: row.status as Goal['status'],
    targetDate: row.target_date ?? undefined,
    completedAt: row.completed_at ?? undefined,
    milestones: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
