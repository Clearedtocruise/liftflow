/**
 * Picks the icon and colour for the Up Next tile from the muscle a session leads with.
 *
 * Small tiles need a shape that survives being 24px tall. An anatomy figure does not, so each
 * training focus maps to a symbol that is readable at a glance and a gradient that separates leg
 * days from push days without needing to read the label.
 */
import type { SFSymbol } from 'sf-symbols-typescript';

import type { MuscleId } from '@/constants/muscles';

export type UpNextGlyph = {
  symbol: SFSymbol;
  /** Android and web have no SF Symbols, so every entry carries a text fallback. */
  fallback: string;
  gradient: readonly [string, string];
};

const PUSH: UpNextGlyph = {
  symbol: 'figure.strengthtraining.traditional',
  fallback: '🏋',
  gradient: ['#0E90FF', '#1F4FD8'],
};

const PULL: UpNextGlyph = {
  symbol: 'figure.play',
  fallback: '🤸',
  gradient: ['#7B5BFF', '#4B2FD8'],
};

const LEGS: UpNextGlyph = {
  symbol: 'figure.run',
  fallback: '🦵',
  gradient: ['#FF8A4C', '#D8452F'],
};

const CORE: UpNextGlyph = {
  symbol: 'figure.core.training',
  fallback: '🧘',
  gradient: ['#00E5A8', '#00A3B8'],
};

const ARMS: UpNextGlyph = {
  symbol: 'dumbbell.fill',
  fallback: '💪',
  gradient: ['#00E5FF', '#0E90FF'],
};

const BY_MUSCLE: Partial<Record<MuscleId, UpNextGlyph>> = {
  chest: PUSH,
  shoulders: PUSH,
  'front-delts': PUSH,
  'side-delts': PUSH,
  triceps: ARMS,
  biceps: ARMS,
  forearms: ARMS,
  lats: PULL,
  'mid-back': PULL,
  'upper-back': PULL,
  traps: PULL,
  'rear-delts': PULL,
  'lower-back': PULL,
  quads: LEGS,
  hamstrings: LEGS,
  glutes: LEGS,
  calves: LEGS,
  adductors: LEGS,
  abductors: LEGS,
  'hip-flexors': LEGS,
  abs: CORE,
  obliques: CORE,
  core: CORE,
  neck: PUSH,
  'full-body': PUSH,
};

export function upNextGlyph(primaryMuscle?: MuscleId): UpNextGlyph {
  if (!primaryMuscle) return PUSH;
  return BY_MUSCLE[primaryMuscle] ?? PUSH;
}
