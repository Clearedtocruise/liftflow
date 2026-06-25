export type Month1ExerciseBlock = {
  block: string;
  name: string;
  slug?: string;
  sets: number;
  reps: string;
  restSeconds: number;
  tempo: string;
  primaryFocus: string;
  supersetPartner?: string | null;
};

export type Month1Workout = {
  week: number;
  day: string;
  dayIndex: number;
  slotLabel: string;
  exercises: Month1ExerciseBlock[];
  workoutNotes: string;
};

export type Month1EncyclopediaEntry = {
  id: number;
  name: string;
  category: string;
  muscles: string;
  howTo: string;
};

export type ReferenceWorkoutExercise = {
  name: string;
  slug: string;
  sets: number;
  reps: string;
  restSeconds: number;
  notes?: string;
  supersetGroupId?: string;
  block?: string;
  tempo?: string;
};
