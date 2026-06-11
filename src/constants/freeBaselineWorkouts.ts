export type FreeBaselineWorkoutId = 'leg-day' | 'push-day' | 'full-body';

export type FreeBaselineExercise = {
  name: string;
  sets: number;
  reps: string;
  notes?: string;
};

export type FreeBaselineWorkout = {
  id: FreeBaselineWorkoutId;
  name: string;
  subtitle: string;
  exercises: FreeBaselineExercise[];
};

/** Always-free workouts available without subscription (~10 exercises each). */
export const FREE_BASELINE_WORKOUTS: FreeBaselineWorkout[] = [
  {
    id: 'leg-day',
    name: 'Leg Day',
    subtitle: 'Squat, hinge, and lunge patterns',
    exercises: [
      { name: 'Barbell Back Squat', sets: 4, reps: '6-8', notes: 'Control the descent' },
      { name: 'Romanian Deadlift', sets: 3, reps: '8-10' },
      { name: 'Leg Press', sets: 3, reps: '10-12' },
      { name: 'Walking Lunge', sets: 3, reps: '10/leg' },
      { name: 'Leg Curl', sets: 3, reps: '10-12' },
      { name: 'Leg Extension', sets: 3, reps: '12-15' },
      { name: 'Hip Thrust', sets: 3, reps: '10-12' },
      { name: 'Bulgarian Split Squat', sets: 3, reps: '8-10/leg' },
      { name: 'Standing Calf Raise', sets: 4, reps: '12-15' },
      { name: 'Seated Calf Raise', sets: 3, reps: '15-20' },
    ],
  },
  {
    id: 'push-day',
    name: 'Push Day',
    subtitle: 'Chest, shoulders, and triceps',
    exercises: [
      { name: 'Barbell Bench Press', sets: 4, reps: '6-8' },
      { name: 'Overhead Press', sets: 3, reps: '8-10' },
      { name: 'Incline Dumbbell Press', sets: 3, reps: '10-12' },
      { name: 'Dumbbell Fly', sets: 3, reps: '12-15' },
      { name: 'Cable Chest Fly', sets: 3, reps: '12-15' },
      { name: 'Lateral Raise', sets: 3, reps: '12-15' },
      { name: 'Front Raise', sets: 2, reps: '12-15' },
      { name: 'Tricep Pushdown', sets: 3, reps: '12-15' },
      { name: 'Skull Crusher', sets: 3, reps: '10-12' },
      { name: 'Overhead Tricep Extension', sets: 3, reps: '12-15' },
    ],
  },
  {
    id: 'full-body',
    name: 'Full Body',
    subtitle: 'Balanced strength for any schedule',
    exercises: [
      { name: 'Barbell Back Squat', sets: 3, reps: '8-10' },
      { name: 'Barbell Bench Press', sets: 3, reps: '8-10' },
      { name: 'Barbell Row', sets: 3, reps: '8-10' },
      { name: 'Overhead Press', sets: 3, reps: '8-10' },
      { name: 'Romanian Deadlift', sets: 3, reps: '8-10' },
      { name: 'Pull-Up', sets: 3, reps: '6-10' },
      { name: 'Dumbbell Lunge', sets: 3, reps: '10/leg' },
      { name: 'Dumbbell Curl', sets: 3, reps: '10-12' },
      { name: 'Face Pull', sets: 3, reps: '15-20' },
      { name: 'Plank', sets: 3, reps: '45-60 sec' },
    ],
  },
];

export function getFreeBaselineWorkout(id: FreeBaselineWorkoutId): FreeBaselineWorkout | undefined {
  return FREE_BASELINE_WORKOUTS.find((workout) => workout.id === id);
}
