import {
    CHALLENGE_CHANCE_AFTER_EXERCISE,
    CHALLENGE_CHANCE_AFTER_SET,
    MAX_CHALLENGES_PER_WORKOUT,
    WORKOUT_CHALLENGE_TEMPLATES,
} from '@/constants/workoutChallenges';
import type {
    WorkoutChallengeRecord,
    WorkoutChallengeTemplate,
    WorkoutChallengeTrigger,
} from '@/types/workoutChallenge';

export function canOfferMoreChallenges(records: WorkoutChallengeRecord[]): boolean {
  return records.length < MAX_CHALLENGES_PER_WORKOUT;
}

export function pickWorkoutChallenge(
  records: WorkoutChallengeRecord[],
  trigger: WorkoutChallengeTrigger,
): WorkoutChallengeTemplate | null {
  if (!canOfferMoreChallenges(records)) return null;

  const chance = trigger === 'between_exercises' ? CHALLENGE_CHANCE_AFTER_EXERCISE : CHALLENGE_CHANCE_AFTER_SET;
  if (Math.random() > chance) return null;

  const usedIds = new Set(records.map((record) => record.challengeId));
  const pool = WORKOUT_CHALLENGE_TEMPLATES.filter((template) => !usedIds.has(template.id));
  if (pool.length === 0) return null;

  return pool[Math.floor(Math.random() * pool.length)] ?? null;
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
