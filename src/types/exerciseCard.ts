import type { MuscleId } from '@/constants/muscles';
import type { MovementCategory } from './common';

export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';

/**
 * Movement archetypes classify exercise patterns for coaching and progression.
 * Every exercise maps to exactly one archetype for consistent card content.
 */
export type MovementArchetype =
  | 'vertical-pull'
  | 'vertical-press'
  | 'horizontal-press'
  | 'horizontal-pull'
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'curl'
  | 'triceps-extension'
  | 'lateral-raise'
  | 'calf-raise'
  | 'core-flexion'
  | 'rotation'
  | 'carry'
  | 'cardio'
  | 'static';

/** How a set is primarily measured — controls the logging panel inputs. */
export type ExerciseMetric = 'reps_weight' | 'reps' | 'time' | 'distance';

export type ExerciseVisualSource = {
  provider: 'gymvisual' | 'gym-animations' | 'exercise-animatic' | 'musclewiki' | 'custom';
  /** Local asset URI or remote URL. */
  uri: string;
  format: 'gif' | 'mp4' | 'webp';
};

/** Top-level body area used for catalog grouping (the 20 coverage groups). */
export type BodyArea =
  | 'Chest'
  | 'Shoulders'
  | 'Triceps'
  | 'Lats'
  | 'Mid Back'
  | 'Rear Delts'
  | 'Upper Back'
  | 'Traps'
  | 'Biceps'
  | 'Forearms'
  | 'Quads'
  | 'Hamstrings'
  | 'Glutes'
  | 'Calves'
  | 'Core'
  | 'Conditioning'
  | 'Full Body'
  | 'Mobility'
  | 'Recovery'
  | 'Sports';

export type ExerciseCardData = {
  slug: string;
  name: string;
  category: MovementCategory;
  bodyArea: BodyArea;
  equipment: string;
  difficulty: Difficulty;

  primaryMuscles: MuscleId[];
  secondaryMuscles: MuscleId[];

  archetype: MovementArchetype;

  /**
   * Optional licensed visual (GIF/MP4) for a future provider layer.
   * When absent the static muscle-highlight figure is shown.
   */
  visualSource?: ExerciseVisualSource;

  /** Section 4 — max 5, specific, no filler. */
  coachingCues: string[];
  /** Section 5 — max 5. */
  commonMistakes: string[];
  /** Section 6 — what the lifter should feel. */
  feel: {
    primary: MuscleId[];
    secondary: MuscleId[];
  };

  /** Section 8 — direct alternatives (same intent), referenced by slug. */
  alternatives: string[];
  /** Section 9 — equipment-independent replacements, referenced by slug. */
  replacements: string[];

  /** Equipment keys this movement requires (for replacement gating). */
  requiresEquipment: string[];

  metric: ExerciseMetric;
  /** Optional rep goal used by the progression section when no user goal set. */
  defaultRepGoal?: number;

  /** True when content is hand-authored and review-complete. */
  authored?: boolean;
};
