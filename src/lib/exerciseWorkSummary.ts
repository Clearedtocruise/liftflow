import { setVolumeKg } from '@/lib/bodyweightVolume';
import type { ExerciseLoggingMode } from '@/lib/exerciseModality';

type LoggedSet = {
  weight?: number | null;
  reps?: number | null;
  durationSeconds?: number | null;
  distanceMeters?: number | null;
};

/**
 * What an exercise's finished sets add up to, in the unit that movement is measured in. A plank
 * or a Tabata round is time, a pull-up is reps, a barbell lift is load × reps — showing all of
 * them as "volume lifted" made every hold and most ab work read as 0.
 */
export type ExerciseWork =
  | { kind: 'time'; seconds: number; sets: number }
  | { kind: 'cardio'; seconds: number; meters: number; sets: number }
  | { kind: 'reps'; reps: number; volumeKg: number; sets: number }
  | { kind: 'volume'; volumeKg: number; reps: number; sets: number };

const positive = (value: number | null | undefined) => (value != null && value > 0 ? value : 0);

export function summarizeExerciseWork(
  mode: ExerciseLoggingMode,
  sets: readonly LoggedSet[],
  exerciseName: string | null | undefined,
  bodyWeightKg: number | null | undefined,
): ExerciseWork {
  const count = sets.length;
  const seconds = sets.reduce((sum, set) => sum + positive(set.durationSeconds), 0);
  const reps = sets.reduce((sum, set) => sum + positive(set.reps), 0);

  if (mode === 'timed') return { kind: 'time', seconds, sets: count };
  if (mode === 'cardio') {
    const meters = sets.reduce((sum, set) => sum + positive(set.distanceMeters), 0);
    return { kind: 'cardio', seconds, meters, sets: count };
  }

  const volumeKg = sets.reduce(
    (sum, set) =>
      sum +
      setVolumeKg(
        {
          isBodyweight: mode === 'bodyweight' || !(positive(set.weight) > 0),
          exerciseName,
          weightKg: set.weight,
          reps: set.reps,
        },
        bodyWeightKg,
      ),
    0,
  );
  if (mode === 'bodyweight') return { kind: 'reps', reps, volumeKg, sets: count };
  return { kind: 'volume', volumeKg, reps, sets: count };
}

export function formatWorkDuration(totalSeconds: number): string {
  const whole = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const seconds = whole % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}
