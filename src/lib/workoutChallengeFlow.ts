import {
    CHALLENGE_CHANCE_AFTER_SET,
    MAX_CHALLENGES_PER_WORKOUT,
    WORKOUT_CHALLENGE_TEMPLATES,
} from '@/constants/workoutChallenges';
import type {
    WorkoutChallengeRecord,
    WorkoutChallengeTemplate,
    WorkoutChallengeTrigger,
} from '@/types/workoutChallenge';

/** Only completed/applied challenges consume the workout quota — skips do not. */
export function canOfferMoreChallenges(records: WorkoutChallengeRecord[]): boolean {
  const completed = records.filter((record) => record.status === 'completed').length;
  return completed < MAX_CHALLENGES_PER_WORKOUT;
}

export function pickWorkoutChallenge(
  records: WorkoutChallengeRecord[],
  trigger: WorkoutChallengeTrigger = 'between_sets',
): WorkoutChallengeTemplate | null {
  if (trigger === 'between_exercises') return null;
  if (!canOfferMoreChallenges(records)) return null;
  if (Math.random() > CHALLENGE_CHANCE_AFTER_SET) return null;

  const usedIds = new Set(records.map((record) => record.challengeId));
  const pool = WORKOUT_CHALLENGE_TEMPLATES.filter((template) => !usedIds.has(template.id));
  if (pool.length === 0) return null;

  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

export type ChallengeDraftBump = {
  reps?: number;
  weightKg?: number;
  notice: string;
};

/** Apply challenge cue to next-set draft inputs (no prediction / pre-log). */
export function applyChallengeDraftBump(
  template: WorkoutChallengeTemplate,
  current: { reps: number; weightKg: number },
): ChallengeDraftBump {
  if (template.id === 'plus-two-reps' || template.kind === 'reps') {
    return {
      reps: current.reps + 2,
      notice: '+2 reps applied to next set',
    };
  }
  if (template.id === 'light-finisher' || template.kind === 'finisher') {
    const nextWeight = Math.max(0, Math.round((current.weightKg * 0.6) / 2.5) * 2.5);
    return {
      weightKg: nextWeight,
      reps: Math.max(current.reps, 15),
      notice: 'Light finisher weight applied',
    };
  }
  if (template.id === 'drop-set' || template.kind === 'drop_set') {
    return {
      notice: 'After this set, drop ~20% and push near failure',
    };
  }
  return {
    notice: template.title,
  };
}

export function serializeChallengeNotes(records: WorkoutChallengeRecord[]): string | undefined {
  if (records.length === 0) return undefined;
  return JSON.stringify({ challenges: records } satisfies { challenges: WorkoutChallengeRecord[] });
}

export function parseChallengeNotes(notes?: string): WorkoutChallengeRecord[] {
  if (!notes) return [];
  try {
    const parsed = JSON.parse(notes) as { challenges?: WorkoutChallengeRecord[] };
    return Array.isArray(parsed.challenges) ? parsed.challenges : [];
  } catch {
    return [];
  }
}
