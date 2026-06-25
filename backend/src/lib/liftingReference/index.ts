export {
  buildReferenceStyleWorkoutPlan,
  buildMonth1ReferenceWorkoutPlan,
  getMonth1Workout,
  resolveMonth1Workout,
  shouldUseReferenceLiftingProgram,
  shouldUseMonth1Reference,
} from './referenceProgramLoader.js';
export { MONTH1_WORKOUTS, MONTH1_WORKOUT_COUNT } from './month1Workouts.js';
export { MONTH1_EXERCISE_SLUG_MAP } from './month1ExerciseSlugMap.js';
export {
  LIFTING_AI_SYSTEM_PROMPT,
  MONTH1_LIFTING_DAYS,
  MONTH1_REFERENCE_WEEKS,
  SPLIT_VOLUME_TARGETS,
  splitKeyFromLabel,
} from './liftingProgrammingRules.js';
export { applyBlockSupersets, enrichWithSmartSupersetGroups } from './applyReferenceSupersets.js';
export type { Month1Workout, Month1ExerciseBlock, Month1EncyclopediaEntry } from './types.js';
