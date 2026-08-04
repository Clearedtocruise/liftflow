import type { ProgramType, UserProfile } from '@/types';

export const PROGRAM_SPLIT_OPTIONS: { id: ProgramType; label: string; hint: string }[] = [
  {
    id: 'push_pull_legs',
    label: 'Push Pull Legs',
    hint: 'Push, Pull, and Legs days — the default for 4+ lift days.',
  },
  {
    id: 'upper_lower',
    label: 'Upper Lower',
    hint: 'Alternating upper- and lower-body days.',
  },
  {
    id: 'full_body',
    label: 'Full Body',
    hint: 'Full-body sessions each lift day.',
  },
  {
    id: 'body_part_split',
    label: 'Body Part Split',
    hint: 'Classic bodybuilding split by muscle group.',
  },
  {
    id: 'strength',
    label: 'Strength',
    hint: 'Squat, Bench, Deadlift, Press, and Pull focus days.',
  },
];

const VALID_TYPES = new Set<string>(PROGRAM_SPLIT_OPTIONS.map((o) => o.id));

export function isProgramType(value: unknown): value is ProgramType {
  return typeof value === 'string' && VALID_TYPES.has(value);
}

export function programSplitLabel(type: ProgramType | string | null | undefined): string {
  if (!isProgramType(type)) return 'Not set';
  return PROGRAM_SPLIT_OPTIONS.find((o) => o.id === type)?.label ?? type;
}

/**
 * Prefer the live program metadata (source of truth for the week), then coachActivation
 * (used by swap/advisory UI), then a sensible default.
 */
export function resolveProgramType(
  user?: UserProfile | null,
  programMetadata?: Record<string, unknown> | null,
): ProgramType {
  const fromProgram = programMetadata?.programType;
  if (isProgramType(fromProgram)) return fromProgram;

  const fromActivation = user?.metadata?.coachActivation?.programType;
  if (isProgramType(fromActivation)) return fromActivation;

  return 'push_pull_legs';
}
