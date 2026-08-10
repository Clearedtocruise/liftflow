/**
 * Aggressive cut home-gym split from the athlete's PDF (193 → 180, 6 days).
 * Exact prescriptions — not adaptive picks.
 */

export type CutExercise = {
  name: string;
  sets: number;
  reps: string;
  restSeconds: number;
  notes?: string;
};

export type CutWorkoutDay = {
  dayIndex: number;
  label: string;
  muscleGroups: string[];
  exercises: CutExercise[];
};

function ex(name: string, sets: number, reps: string, restSeconds = 90, notes?: string): CutExercise {
  return { name, sets, reps, restSeconds, notes };
}

/** Monday–Saturday lift days; Sunday is recovery (no planned strength session). */
export const AGGRESSIVE_CUT_WORKOUT_DAYS: CutWorkoutDay[] = [
  {
    dayIndex: 0,
    label: 'Back + Rear Delts',
    muscleGroups: ['back', 'shoulders', 'biceps', 'core'],
    exercises: [
      ex('Pull-Up', 5, '5', 180),
      ex('Barbell Row', 5, '6', 150),
      ex('One-Arm Dumbbell Row', 4, '10', 90),
      ex('Dumbbell Rear Delt Raise', 4, '15', 60),
      ex('Barbell Shrug', 4, '12-15', 75),
      ex('Barbell Curl', 4, '8-10', 75),
      ex('Hammer Curl', 3, '12', 60),
      ex('Hanging Leg Raise', 3, '12', 60),
      ex('Plank', 3, '60 sec', 45, 'Timed hold'),
    ],
  },
  {
    dayIndex: 1,
    label: 'Chest + Triceps',
    muscleGroups: ['chest', 'triceps', 'shoulders', 'core'],
    exercises: [
      ex('Bench Press', 5, '5', 180),
      ex('Incline Dumbbell Press', 4, '8', 120),
      ex('Close-Grip Bench Press', 4, '8', 120),
      ex('Skull Crusher', 4, '10', 75),
      ex('Dumbbell Lateral Raise', 4, '15', 60),
      ex('Weighted Sit-Up', 3, '15', 45),
    ],
  },
  {
    dayIndex: 2,
    label: 'Legs',
    muscleGroups: ['quads', 'hamstrings', 'glutes', 'calves', 'core'],
    exercises: [
      ex('Back Squat', 5, '5', 180),
      ex('Romanian Deadlift', 4, '8', 150),
      ex('Walking Lunge', 4, '10', 90, 'Each leg'),
      ex('Calf Raise', 5, '15-20', 60),
      ex('Side Plank', 3, '30 sec', 45, 'Each side'),
    ],
  },
  {
    dayIndex: 3,
    label: 'Shoulders + Chest Volume',
    muscleGroups: ['shoulders', 'chest', 'core'],
    exercises: [
      ex('Overhead Press', 5, '5', 180),
      ex('Incline Dumbbell Press', 4, '10-12', 90),
      ex('Dumbbell Lateral Raise', 5, '15-20', 60),
      ex('Dumbbell Rear Delt Raise', 4, '15', 60),
      ex('Bench Press', 3, '12', 90, 'Lighter volume set'),
      ex('Dead Bug', 3, '12', 45, 'Each side'),
    ],
  },
  {
    dayIndex: 4,
    label: 'Back + Arms',
    muscleGroups: ['back', 'biceps', 'shoulders'],
    exercises: [
      ex('Chin-Up', 4, 'AMRAP', 150),
      ex('Dumbbell Row', 4, '12', 90),
      ex('Barbell Row', 3, '10', 120),
      ex('Barbell Shrug', 4, '15', 75),
      ex('Barbell Curl', 4, '12', 75),
      ex('Hammer Curl', 3, '15', 60),
    ],
  },
  {
    dayIndex: 5,
    label: 'Legs + Abs',
    muscleGroups: ['quads', 'hamstrings', 'glutes', 'calves', 'core'],
    exercises: [
      ex('Front Squat', 4, '8', 150),
      ex('Romanian Deadlift', 4, '10', 120),
      ex('Step-Up', 4, '12', 75, 'Each leg'),
      ex('Calf Raise', 5, '20', 60),
      ex('Barbell Rollout', 3, '12', 60),
      ex('Hanging Leg Raise', 3, '12', 60),
    ],
  },
];

export const AGGRESSIVE_CUT_PLAN_ID = 'aggressive_cut';
export const AGGRESSIVE_CUT_PROGRAM_NAME = 'Aggressive Cut — 6 Day';
