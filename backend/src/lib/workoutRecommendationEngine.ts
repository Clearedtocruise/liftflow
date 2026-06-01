import {
  addDays,
  buildWeeklySchedule,
  dayLabel,
  type DaySlot,
  type ProgramFrequency,
  type ProgramType,
} from './programTypes.js';
import { inferProgramFrequency, inferProgramType } from './programSelection.js';
import type { GeneratedWorkoutPlan } from './workoutPlanner.js';

export type WorkoutSplitStyle =
  | 'push_pull_legs'
  | 'upper_lower'
  | 'full_body'
  | 'bodybuilding'
  | 'powerlifting'
  | 'strength'
  | 'fat_loss';

export type GoalFocus = 'strength' | 'hypertrophy' | 'fat_loss' | 'powerlifting' | 'general';

export type MuscleExplanation = {
  muscle: string;
  reason: string;
};

export type DailyWorkoutRecommendation = {
  date: string;
  dayLabel: string;
  isRestDay: boolean;
  sessionLabel?: string;
  targetMuscles: string[];
  workout?: GeneratedWorkoutPlan;
  whySelected: string[];
  whyNotSelected: MuscleExplanation[];
  voiceLine: string;
};

export type WeeklyPlanDay = {
  date: string;
  dayLabel: string;
  isRestDay: boolean;
  sessionLabel?: string;
  targetMuscles: string[];
  estimatedMinutes?: number;
};

export type WorkoutRecommendationContext = {
  userId: string;
  recoveryScore: number;
  recoveryStatus: string;
  trainingRecommendation: string;
  goalFocus: GoalFocus;
  splitStyle: WorkoutSplitStyle;
  splitLabel: string;
  frequency: number;
  adherencePct: number;
  missedWorkoutCount: number;
  weakMuscleGroups: string[];
  suggestedMuscleGroups: string[];
  avoidMuscleGroups: string[];
  workoutsLast7d: number;
  basedOnSessionCount: number;
};

export type WorkoutRecommendationReport = {
  assessedAt: string;
  context: WorkoutRecommendationContext;
  today: DailyWorkoutRecommendation;
  tomorrow: DailyWorkoutRecommendation;
  weeklyPlan: WeeklyPlanDay[];
  voiceTrainTodayLine: string;
  voiceBuildWorkoutLine: string;
};

export type RecommendationEngineInput = {
  userId: string;
  today: string;
  recoveryScore: number;
  recoveryStatus: string;
  trainingRecommendation: string;
  suggestedMuscleGroups: string[];
  avoidMuscleGroups: string[];
  muscleRecovery: Array<{ muscle: string; score: number; hoursSinceTraining?: number; weeklyVolume: number }>;
  fitnessGoals: string[];
  primaryGoal: string;
  daysPerWeek: number;
  splitStyle: WorkoutSplitStyle;
  weeklyMuscleVolume: Map<string, number>;
  missedWorkouts: Array<{ date: string; name: string; muscleGroups: string[] }>;
  plannedThisWeek: number;
  completedThisWeek: number;
  sessions7d: number;
  activeProgramSlot?: { label: string; muscleGroups: string[]; date: string };
};

const TRACKED_MUSCLES = ['chest', 'back', 'legs', 'shoulders', 'biceps', 'triceps', 'core', 'arms', 'glutes'];

const SPLIT_LABELS: Record<WorkoutSplitStyle, string> = {
  push_pull_legs: 'Push / Pull / Legs',
  upper_lower: 'Upper / Lower',
  full_body: 'Full Body',
  bodybuilding: 'Bodybuilding Split',
  powerlifting: 'Powerlifting',
  strength: 'Strength',
  fat_loss: 'Fat Loss',
};

export function splitStyleToProgramType(style: WorkoutSplitStyle): ProgramType {
  switch (style) {
    case 'push_pull_legs':
      return 'push_pull_legs';
    case 'upper_lower':
    case 'fat_loss':
      return 'upper_lower';
    case 'full_body':
      return 'full_body';
    case 'bodybuilding':
      return 'body_part_split';
    case 'powerlifting':
    case 'strength':
      return 'strength';
    default:
      return 'upper_lower';
  }
}

export function inferSplitStyle(fitnessGoals: string[], daysPerWeek: number): WorkoutSplitStyle {
  const primary = fitnessGoals[0] ?? 'general_fitness';
  if (primary === 'strength') return 'strength';
  if (fitnessGoals.includes('strength') && fitnessGoals.includes('hypertrophy')) return 'powerlifting';
  if (primary === 'hypertrophy' || primary === 'muscle_gain') {
    return daysPerWeek >= 5 ? 'bodybuilding' : 'push_pull_legs';
  }
  if (primary === 'fat_loss' || primary === 'weight_loss') return 'fat_loss';
  if (daysPerWeek <= 3) return 'full_body';
  if (daysPerWeek >= 5) return 'push_pull_legs';
  return 'upper_lower';
}

export function resolveGoalFocus(fitnessGoals: string[]): GoalFocus {
  const primary = fitnessGoals[0];
  if (primary === 'strength') return 'strength';
  if (primary === 'fat_loss' || primary === 'weight_loss') return 'fat_loss';
  if (primary === 'hypertrophy' || primary === 'muscle_gain') return 'hypertrophy';
  if (fitnessGoals.includes('strength')) return 'powerlifting';
  return 'general';
}

function dayOfWeekIndex(dateStr: string): number {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  return day === 0 ? 6 : day - 1;
}

function expandMuscle(mg: string): string[] {
  if (mg === 'arms') return ['biceps', 'triceps'];
  if (mg === 'legs') return ['legs', 'glutes', 'hamstrings'];
  return [mg];
}

function overlapsMuscle(a: string[], b: string[]): boolean {
  const setA = new Set(a.flatMap(expandMuscle));
  return b.some((m) => setA.has(m) || setA.has(m.split('_')[0] ?? m));
}

function pickWeakMuscles(
  weeklyVolume: Map<string, number>,
  muscleRecovery: RecommendationEngineInput['muscleRecovery'],
): string[] {
  const volumePairs = [...weeklyVolume.entries()].sort((a, b) => a[1] - b[1]);
  const weakFromVolume = volumePairs.slice(0, 3).map(([m]) => m);
  const weakFromRecovery = [...muscleRecovery]
    .sort((a, b) => a.score - b.score)
    .slice(0, 2)
    .map((m) => m.muscle);
  return [...new Set([...weakFromRecovery, ...weakFromVolume])].slice(0, 3);
}

function resolveDayMuscles(
  slot: DaySlot,
  input: RecommendationEngineInput,
  weakMuscles: string[],
): { muscles: string[]; whySelected: string[] } {
  const whySelected: string[] = [];
  let muscles = [...slot.muscleGroups];

  if (input.activeProgramSlot && input.activeProgramSlot.date === input.today && input.activeProgramSlot.muscleGroups.length) {
    muscles = input.activeProgramSlot.muscleGroups;
    whySelected.push(`Active program schedules ${input.activeProgramSlot.label} today.`);
  } else {
    whySelected.push(`${slot.label} day on your ${SPLIT_LABELS[input.splitStyle]} split.`);
  }

  if (input.suggestedMuscleGroups.length > 0 && overlapsMuscle(muscles, input.suggestedMuscleGroups)) {
    whySelected.push(`Recovery intelligence flagged ${input.suggestedMuscleGroups.join(', ')} as fresh.`);
  }

  const weakHit = weakMuscles.filter((w) => overlapsMuscle(muscles, [w]));
  if (weakHit.length > 0) {
    whySelected.push(`Prioritizes under-trained groups: ${weakHit.join(', ')} (low weekly volume).`);
  }

  if (input.missedWorkouts.length > 0) {
    const missed = input.missedWorkouts[0];
    if (missed && overlapsMuscle(muscles, missed.muscleGroups)) {
      whySelected.push(`Catches up missed session from ${missed.date} (${missed.name}).`);
    }
  }

  if (input.trainingRecommendation === 'train_light') {
    whySelected.push('Volume reduced ~20% because recovery suggests training light.');
  }

  muscles = muscles.filter((m) => !input.avoidMuscleGroups.some((a) => overlapsMuscle([m], [a])));
  if (muscles.length === 0) {
    muscles = input.suggestedMuscleGroups.length ? input.suggestedMuscleGroups : ['chest', 'back'];
    whySelected.push('Original split muscles fatigued — rotated to freshest available groups.');
  }

  return { muscles, whySelected };
}

function buildWhyNotSelected(
  targetMuscles: string[],
  input: RecommendationEngineInput,
  schedule: DaySlot[],
  dayIndex: number,
): MuscleExplanation[] {
  const explanations: MuscleExplanation[] = [];

  for (const muscle of TRACKED_MUSCLES) {
    if (overlapsMuscle(targetMuscles, [muscle])) continue;

    const rec = input.muscleRecovery.find((m) => m.muscle === muscle || expandMuscle(muscle).includes(m.muscle));
    if (input.avoidMuscleGroups.some((a) => overlapsMuscle([muscle], [a]))) {
      explanations.push({ muscle, reason: 'Recovery score too low — avoid loading today.' });
      continue;
    }

    if (rec && rec.hoursSinceTraining != null && rec.hoursSinceTraining < 48) {
      explanations.push({
        muscle,
        reason: `Trained ${rec.hoursSinceTraining}h ago — still recovering (${rec.score}/100 readiness).`,
      });
      continue;
    }

    const futureSlot = schedule.find(
      (s, idx) => idx > dayIndex && !s.isRest && overlapsMuscle(s.muscleGroups, [muscle]),
    );
    if (futureSlot) {
      explanations.push({ muscle, reason: `Scheduled on ${futureSlot.label} day later this week.` });
      continue;
    }

    const vol = input.weeklyMuscleVolume.get(muscle) ?? 0;
    if (vol > 12000) {
      explanations.push({ muscle, reason: `Already high weekly volume (${Math.round(vol).toLocaleString()}).` });
      continue;
    }

    explanations.push({ muscle, reason: 'Not part of today\'s split focus.' });
  }

  return explanations.slice(0, 6);
}

function buildDailyRec(
  dateStr: string,
  slot: DaySlot,
  input: RecommendationEngineInput,
  schedule: DaySlot[],
  weakMuscles: string[],
  adherencePct: number,
  workout?: GeneratedWorkoutPlan,
): DailyWorkoutRecommendation {
  const idx = dayOfWeekIndex(dateStr);

  if (slot.isRest || input.trainingRecommendation === 'rest_day') {
    return {
      date: dateStr,
      dayLabel: dayLabel(idx),
      isRestDay: true,
      targetMuscles: [],
      whySelected: input.trainingRecommendation === 'rest_day'
        ? [`Recovery score ${input.recoveryScore} — rest day recommended.`]
        : ['Rest day on your weekly split.'],
      whyNotSelected: [],
      voiceLine: 'Take a rest day. Your recovery score supports full rest today.',
    };
  }

  if (input.trainingRecommendation === 'recovery_session' && dateStr === input.today) {
    return {
      date: dateStr,
      dayLabel: dayLabel(idx),
      isRestDay: false,
      sessionLabel: 'Recovery Session',
      targetMuscles: ['core'],
      workout,
      whySelected: [
        `Recovery score ${input.recoveryScore} — light mobility and technique only.`,
        'Heavy loading deferred until readiness improves.',
      ],
      whyNotSelected: TRACKED_MUSCLES.filter((m) => m !== 'core').map((muscle) => ({
        muscle,
        reason: 'Fatigue elevated — save heavy work for a future session.',
      })),
      voiceLine: 'Do a light recovery session — mobility, walking, or easy movement only.',
    };
  }

  const { muscles, whySelected } = resolveDayMuscles(slot, input, weakMuscles);
  whySelected.unshift(`Recovery score ${input.recoveryScore} (${input.recoveryStatus.replace(/_/g, ' ')}).`);

  if (adherencePct < 70 && input.plannedThisWeek > 0) {
    whySelected.push(`Adherence ${adherencePct}% this week — simplified session to rebuild consistency.`);
  }

  const voiceLine = workout
    ? `Today is ${slot.label}: ${workout.exercises.slice(0, 3).map((e) => e.name).join(', ')}${workout.exercises.length > 3 ? ', and more' : ''}.`
    : `Train ${muscles.join(' and ')} today — ${slot.label} focus.`;

  return {
    date: dateStr,
    dayLabel: dayLabel(idx),
    isRestDay: false,
    sessionLabel: slot.label,
    targetMuscles: muscles,
    workout,
    whySelected,
    whyNotSelected: buildWhyNotSelected(muscles, input, schedule, idx),
    voiceLine,
  };
}

export function computeWorkoutRecommendations(
  input: RecommendationEngineInput,
  workoutsByDate: Map<string, GeneratedWorkoutPlan | undefined>,
): Omit<WorkoutRecommendationReport, 'assessedAt'> {
  const programType = splitStyleToProgramType(input.splitStyle);
  const frequency = inferProgramFrequency({
    fitnessGoals: input.fitnessGoals,
    primaryGoal: input.primaryGoal,
    daysPerWeek: input.daysPerWeek,
  }) as number;
  const schedule = buildWeeklySchedule(programType, frequency as ProgramFrequency);
  const weakMuscles = pickWeakMuscles(input.weeklyMuscleVolume, input.muscleRecovery);
  const adherencePct =
    input.plannedThisWeek > 0 ? Math.round((input.completedThisWeek / input.plannedThisWeek) * 100) : 100;

  const todayIdx = dayOfWeekIndex(input.today);
  const tomorrow = addDays(input.today, 1);
  const tomorrowIdx = dayOfWeekIndex(tomorrow);

  const todaySlot = schedule[todayIdx] ?? schedule[0]!;
  const tomorrowSlot = schedule[tomorrowIdx] ?? schedule[1]!;

  const today = buildDailyRec(
    input.today,
    todaySlot,
    input,
    schedule,
    weakMuscles,
    adherencePct,
    workoutsByDate.get(input.today),
  );
  const tomorrowRec = buildDailyRec(
    tomorrow,
    tomorrowSlot,
    input,
    schedule,
    weakMuscles,
    adherencePct,
    workoutsByDate.get(tomorrow),
  );

  const weeklyPlan: WeeklyPlanDay[] = schedule.map((slot, index) => {
    const date = addDays(input.today, index - todayIdx);
    const plan = workoutsByDate.get(date);
    return {
      date,
      dayLabel: dayLabel(index),
      isRestDay: slot.isRest,
      sessionLabel: slot.isRest ? undefined : slot.label,
      targetMuscles: slot.isRest ? [] : slot.muscleGroups,
      estimatedMinutes: plan?.estimatedMinutes,
    };
  });

  const context: WorkoutRecommendationContext = {
    userId: input.userId,
    recoveryScore: input.recoveryScore,
    recoveryStatus: input.recoveryStatus,
    trainingRecommendation: input.trainingRecommendation,
    goalFocus: resolveGoalFocus(input.fitnessGoals),
    splitStyle: input.splitStyle,
    splitLabel: SPLIT_LABELS[input.splitStyle],
    frequency,
    adherencePct,
    missedWorkoutCount: input.missedWorkouts.length,
    weakMuscleGroups: weakMuscles,
    suggestedMuscleGroups: input.suggestedMuscleGroups,
    avoidMuscleGroups: input.avoidMuscleGroups,
    workoutsLast7d: input.sessions7d,
    basedOnSessionCount: input.sessions7d,
  };

  const voiceTrainTodayLine = today.isRestDay
    ? today.voiceLine
    : today.workout
      ? `Train ${today.sessionLabel ?? 'today'}: ${today.workout.name}. ${today.whySelected[0] ?? ''}`
      : today.voiceLine;

  const voiceBuildWorkoutLine = today.workout
    ? `Built your workout: ${today.workout.exercises.length} exercises, about ${today.workout.estimatedMinutes} minutes. ${today.workout.rationale.split('.')[0]}.`
    : voiceTrainTodayLine;

  return {
    context,
    today,
    tomorrow: tomorrowRec,
    weeklyPlan,
    voiceTrainTodayLine,
    voiceBuildWorkoutLine,
  };
}

export function inferSplitFromProfile(
  fitnessGoals: string[],
  primaryGoal: string | undefined,
  daysPerWeek: number,
  metadata?: Record<string, unknown>,
): WorkoutSplitStyle {
  const coachProfile = (metadata?.coachProfile ?? {}) as { programType?: string };
  if (coachProfile.programType) {
    const mapped = coachProfile.programType as WorkoutSplitStyle;
    if (SPLIT_LABELS[mapped]) return mapped;
  }
  return inferSplitStyle(fitnessGoals.length ? fitnessGoals : primaryGoal ? [primaryGoal] : [], daysPerWeek);
}

export function inferDaysPerWeek(metadata?: Record<string, unknown>, sessionCount7d?: number): number {
  const coachProfile = (metadata?.coachProfile ?? {}) as { daysPerWeek?: number };
  if (coachProfile.daysPerWeek && coachProfile.daysPerWeek >= 3) return coachProfile.daysPerWeek;
  if (sessionCount7d != null && sessionCount7d > 0) return Math.min(6, Math.max(3, Math.round(sessionCount7d)));
  return 4;
}
