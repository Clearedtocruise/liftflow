import { inferExerciseMetadata } from '@/lib/exerciseEducation/inferExerciseMetadata';
import { buildExerciseGuide, describeEquipment } from '@/lib/exerciseGuideBuilder';
import type { ExerciseFormGuide, IllustratedMovementStep } from '@/lib/exerciseGuideTypes';
import type { Exercise } from '@/types';
import type { MovementCategory } from '@/types/common';

function humanizeMuscle(muscle: string): string {
  return muscle.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildSummary(name: string, primary: string[]): string {
  const muscles = primary.slice(0, 2).map(humanizeMuscle).join(' and ');
  return `${name} targets your ${muscles}. Follow the setup and movement cues below for safe, effective reps.`;
}

function buildIllustratedSteps(guide: ExerciseFormGuide): IllustratedMovementStep[] {
  // Structured setup/movement sections are shown in the guide sheet — skip a parallel breakdown.
  if (guide.setup && guide.movement) return [];

  const steps: IllustratedMovementStep[] = [];
  if (guide.setup) steps.push({ label: 'Setup', description: guide.setup });
  if (guide.startPosition) steps.push({ label: 'Start', description: guide.startPosition });
  if (guide.movement) steps.push({ label: 'Move', description: guide.movement });
  if (guide.endPosition) steps.push({ label: 'Finish', description: guide.endPosition });
  if (steps.length >= 2) return steps;

  return (guide.steps ?? []).map((step, index) => ({
    label: `Step ${index + 1}`,
    description: step,
  }));
}

function coachingCuesFromGuide(guide: ExerciseFormGuide, name: string): string[] {
  if (guide.coachingCues?.length) return guide.coachingCues;
  const cues: string[] = [];
  if (guide.muscleFocus) cues.push(guide.muscleFocus.split('.')[0] ?? guide.muscleFocus);
  if (guide.movement) cues.push(guide.movement.split('.')[0] ?? guide.movement);
  if (cues.length === 0) {
    cues.push(`Control each rep of ${name}`, 'Breathe steadily', 'Stop if form breaks');
  }
  return cues.slice(0, 4);
}

function mistakesFromGuide(guide: ExerciseFormGuide): string[] {
  if (guide.commonMistakes?.length) return guide.commonMistakes;
  if (guide.tips?.length) return guide.tips;
  return ['Using momentum instead of muscle control', 'Letting joints fall out of alignment', 'Holding your breath through the rep'];
}

/** Build complete exercise education using name-corrected metadata. */
export function buildExerciseEducation(
  exercise: Exercise | null | undefined,
  nameFallback?: string,
): ExerciseFormGuide {
  const name = exercise?.name ?? nameFallback ?? 'Exercise';
  const inferred = inferExerciseMetadata({
    name,
    slug: exercise?.slug,
    category: exercise?.category,
    equipment: exercise?.equipment,
    muscleGroups: exercise?.muscleGroups,
    secondaryMuscles: exercise?.secondaryMuscles,
    exerciseType: exercise?.exerciseType,
  });

  const correctedExercise: Exercise = {
    id: exercise?.id ?? 'education',
    name,
    slug: exercise?.slug,
    category: inferred.movementCategory as MovementCategory,
    exerciseType: inferred.exerciseType,
    equipment: inferred.equipment,
    muscleGroups: inferred.primaryMuscles,
    secondaryMuscles: inferred.secondaryMuscles,
    isSystem: exercise?.isSystem ?? true,
    createdAt: exercise?.createdAt ?? new Date().toISOString(),
  };

  const base = buildExerciseGuide(correctedExercise, name);
  const equipmentText =
    base.equipment ??
    describeEquipment(inferred.equipment, name, inferred.requires);

  const enriched: ExerciseFormGuide = {
    ...base,
    summary: base.summary ?? buildSummary(name, inferred.primaryMuscles),
    equipment: equipmentText,
    musclesWorked: {
      primary: inferred.primaryMuscles,
      secondary: inferred.secondaryMuscles,
    },
    equipmentRequired: inferred.requires,
    feelShould: base.feelShould ?? inferred.feelShould,
    feelShouldNot: base.feelShouldNot ?? inferred.feelShouldNot,
    coachingCues: coachingCuesFromGuide(base, name),
    commonMistakes: mistakesFromGuide(base),
    illustratedSteps: base.illustratedSteps ?? buildIllustratedSteps(base),
    tips: base.tips ?? mistakesFromGuide(base),
  };

  return enriched;
}

export function educationHasRequiredFields(guide: ExerciseFormGuide | null): boolean {
  if (!guide) return false;
  const hasMovement =
    Boolean(guide.movement) ||
    Boolean(guide.setup) ||
    (guide.steps?.length ?? 0) >= 2 ||
    (guide.illustratedSteps?.length ?? 0) >= 2;
  return Boolean(
    guide.summary &&
      guide.equipment &&
      hasMovement &&
      (guide.musclesWorked?.primary.length ?? 0) > 0 &&
      (guide.feelShould?.length ?? 0) > 0 &&
      (guide.feelShouldNot?.length ?? 0) > 0,
  );
}
