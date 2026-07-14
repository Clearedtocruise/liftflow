import { catalogExerciseBySlug } from '@/constants/exerciseDatabase';
import { buildExerciseEducation } from '@/lib/exerciseEducation/buildExerciseEducation';
import { enrichLegacyGuide as enrichStepsToGuide } from '@/lib/exerciseGuideBuilder';
import type { ExerciseFormGuide } from '@/lib/exerciseGuideTypes';
import { STRUCTURED_EXERCISE_GUIDES } from '@/lib/exerciseStructuredGuides';
import { GENERATED_STRUCTURED_FORM_GUIDES } from '@/lib/generatedStructuredFormGuides';
import { month1GuideFromEncyclopedia } from '@/lib/liftingReference/month1ExerciseEncyclopedia';
import type { Exercise } from '@/types';
import type { MovementCategory } from '@/types/common';

export { guideHasStructure, guideSections } from '@/lib/exerciseGuideTypes';
export type { ExerciseFormGuide, GuideSection } from '@/lib/exerciseGuideTypes';

const REP_RANGE_PATTERN = /^\d+(-\d+)?$/;
const TIMED_REP_RANGE_PATTERN = /\d+\s*(s|sec|secs|second|seconds|min|mins|minute|minutes)\b/i;

function normalizeKey(value: string | undefined | null): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function isRepRangeText(value: string): boolean {
  const trimmed = value.trim();
  return REP_RANGE_PATTERN.test(trimmed) || TIMED_REP_RANGE_PATTERN.test(trimmed);
}

function guideFromInstructions(text: string): ExerciseFormGuide | null {
  const trimmed = text.trim();
  if (!trimmed || isRepRangeText(trimmed)) return null;

  const lines = trimmed
    .split(/\n+/)
    .map((line) => line.replace(/^[\d•\-.\s]+/, '').trim())
    .filter(Boolean);

  if (lines.length === 0) return null;
  return { steps: lines };
}

function guideContext(exercise: Exercise | null | undefined, name: string) {
  const slug = exercise?.slug ?? normalizeKey(name);
  const catalog = catalogExerciseBySlug(slug);
  return {
    name: exercise?.name ?? name,
    slug,
    category: (exercise?.category ?? catalog?.movementCategory ?? 'other') as MovementCategory,
    equipment: exercise?.equipment ?? catalog?.equipment ?? 'bodyweight',
    muscleGroups: exercise?.muscleGroups ?? catalog?.muscleGroups ?? [],
    family: catalog?.metadata?.movement_family,
    requires: catalog?.metadata?.requires,
  };
}

/** Legacy step-only guides — enriched at resolve time */
const LEGACY_STEPS_BY_SLUG: Record<string, ExerciseFormGuide> = {
  'incline-bench-press': {
    steps: [
      'Set the bench to 30–45° and sit with feet planted.',
      'Grip the bar slightly wider than shoulders and unrack over upper chest.',
      'Lower to the upper chest/clavicle line with controlled elbows.',
      'Press up and slightly back to the start position.',
    ],
  },
  'front-squat': {
    steps: [
      'Rest the bar on front delts with elbows high and fingers under the bar.',
      'Stand tall, brace, and sit straight down between your hips.',
      'Keep torso upright as you descend to parallel or below.',
      'Drive up through mid-foot while keeping elbows from dropping.',
    ],
  },
  'dumbbell-curl': {
    steps: [
      'Stand tall with dumbbells at your sides, palms forward.',
      'Keep elbows pinned near your ribs.',
      'Curl up without swinging, squeezing biceps at the top.',
      'Lower slowly to full extension.',
    ],
  },
  'hammer-curl': {
    steps: [
      'Hold dumbbells with neutral (palms-in) grip at your sides.',
      'Curl up while keeping elbows fixed.',
      'Pause briefly at the top.',
      'Lower under control without rocking your torso.',
    ],
  },
  'tricep-pushdown': {
    steps: [
      'Stand at the cable with elbows tucked to your sides.',
      'Start with forearms roughly parallel to the floor.',
      'Extend elbows to push the handle down.',
      'Return with control without letting elbows drift forward.',
    ],
  },
  'leg-curl': {
    steps: [
      'Align knees with the machine pivot and pad on lower calves.',
      'Curl heels toward glutes in a smooth arc.',
      'Squeeze hamstrings at the top.',
      'Return slowly without letting the weight slam.',
    ],
  },
  'calf-raise': {
    steps: [
      'Place balls of feet on the edge with heels hanging.',
      'Rise onto toes as high as possible.',
      'Pause at the top.',
      'Lower heels below the platform for a full stretch.',
    ],
  },
  'dumbbell-bench-press': {
    steps: [
      'Lie back with dumbbells at chest level, feet planted.',
      'Press up until arms are extended over shoulders.',
      'Lower with elbows at ~45° until upper arms are parallel to the floor.',
      'Press back up without bouncing at the bottom.',
    ],
  },
  'dumbbell-shoulder-press': {
    steps: [
      'Sit or stand with dumbbells at shoulder height, palms forward.',
      'Brace core and press straight up.',
      'Stop just before elbows lock out overhead.',
      'Lower under control to shoulder level.',
    ],
  },
  'dumbbell-rdl': {
    steps: [
      'Hold dumbbells in front of thighs with soft knees.',
      'Hinge hips back, sliding weights down your legs.',
      'Stop when hamstrings stretch with a flat back.',
      'Squeeze glutes to return upright.',
    ],
  },
  'dumbbell-lunge': {
    steps: [
      'Hold dumbbells at your sides, stand tall.',
      'Step forward and lower until both knees are near 90°.',
      'Keep front knee over mid-foot, torso upright.',
      'Push through front foot to return and alternate legs.',
    ],
  },
  'walking-lunge': {
    steps: [
      'Stand tall and step forward into a lunge.',
      'Back knee drops toward the floor without touching.',
      'Push off the front foot into the next step.',
      'Continue alternating with controlled steps.',
    ],
  },
  'reverse-lunge': {
    steps: [
      'Stand tall with feet hip-width.',
      'Step one foot back and lower until both knees bend ~90°.',
      'Keep front shin mostly vertical and torso upright.',
      'Drive through the front foot to return to standing.',
    ],
  },
  'lateral-lunge': {
    steps: [
      'Stand tall, take a wide step to the side.',
      'Sit hips back on the stepping leg while keeping the other leg straight.',
      'Keep chest up and knee tracking over toes.',
      'Push off the bent leg to return to center and switch sides.',
    ],
  },
  'step-up': {
    steps: [
      'Place one foot fully on a box or bench.',
      'Drive through that heel to stand on top without pushing off the back foot.',
      'Step down under control.',
      'Complete all reps on one side or alternate as programmed.',
    ],
  },
  'glute-bridge': {
    steps: [
      'Lie on your back, knees bent, feet flat near hips.',
      'Brace core and drive hips up by squeezing glutes.',
      'Pause at the top without arching lower back excessively.',
      'Lower slowly to the floor.',
    ],
  },
  'single-leg-rdl': {
    steps: [
      'Stand on one leg holding a weight in the opposite hand.',
      'Hinge at the hip, extending the free leg behind you for balance.',
      'Keep hips square and back flat until hamstring stretches.',
      'Return to standing by driving hips forward.',
    ],
  },
  'chin-up': {
    steps: [
      'Hang with palms facing you, shoulder-width grip.',
      'Set shoulders down and back before pulling.',
      'Pull until chin clears the bar.',
      'Lower slowly to full extension.',
    ],
  },
  dip: {
    steps: [
      'Support yourself on parallel bars with arms extended.',
      'Lower by bending elbows until upper arms are about parallel to the floor.',
      'Keep shoulders down and torso slightly forward for chest emphasis.',
      'Press back up without locking elbows aggressively.',
    ],
  },
  'bodyweight-squat': {
    steps: [
      'Feet shoulder-width, toes slightly out.',
      'Sit hips back and down keeping chest up.',
      'Descend until thighs are parallel or as deep as mobility allows.',
      'Drive through mid-foot to stand.',
    ],
  },
  'pistol-squat': {
    steps: [
      'Stand on one leg with the other leg extended in front.',
      'Sit back and down on the working leg with arms forward for balance.',
      'Keep heel down and knee tracking over toes.',
      'Drive up to standing without losing balance.',
    ],
  },
  plank: {
    steps: [
      'Forearms on the floor, elbows under shoulders.',
      'Extend legs and brace core, glutes, and quads.',
      'Keep body in a straight line—no sagging hips or piking.',
      'Hold steady breathing without losing position.',
    ],
  },
  'side-plank': {
    steps: [
      'Stack feet and support on one forearm, elbow under shoulder.',
      'Lift hips until body forms a straight line.',
      'Keep top hip stacked over bottom hip.',
      'Hold without letting hips drop.',
    ],
  },
  'hanging-leg-raise': {
    steps: [
      'Hang from a bar with shoulders engaged (not fully relaxed).',
      'Brace core and raise legs with control.',
      'Lift until thighs pass parallel or as high as mobility allows.',
      'Lower slowly without swinging.',
    ],
  },
  'cable-fly': {
    steps: [
      'Set cables at chest height and take a staggered stance.',
      'Start with a slight bend in elbows and open chest.',
      'Bring handles together in a hugging arc.',
      'Return slowly until you feel a chest stretch.',
    ],
  },
  'seated-cable-row': {
    steps: [
      'Sit tall with feet on platform, slight knee bend.',
      'Grab handle with arms extended, shoulders down.',
      'Row to your lower ribs, squeezing shoulder blades.',
      'Return with control without rounding your back.',
    ],
  },
  'skull-crusher': {
    steps: [
      'Lie on a bench holding a bar or EZ bar over chest.',
      'Keep upper arms vertical as you bend elbows.',
      'Lower the bar toward forehead or behind head with control.',
      'Extend elbows to press back up.',
    ],
  },
  'hack-squat': {
    steps: [
      'Shoulders under pads, back flat, feet shoulder-width on platform.',
      'Unlock and lower until knees reach ~90° without hips lifting.',
      'Press through mid-foot to extend legs.',
      'Keep knees aligned with toes throughout.',
    ],
  },
  'landmine-squat': {
    steps: [
      'Hold the end of the barbell at chest height.',
      'Stand with feet shoulder-width, toes slightly out.',
      'Squat down keeping chest tall and bar close.',
      'Drive up through mid-foot to stand.',
    ],
  },
  'landmine-rdl': {
    steps: [
      'Hold the barbell end with both hands at hip height.',
      'Hinge back with soft knees, bar traveling close to legs.',
      'Stop at hamstring stretch with flat back.',
      'Drive hips forward to stand.',
    ],
  },
  'sumo-deadlift': {
    steps: [
      'Wide stance, toes out, bar over mid-foot.',
      'Grip inside knees with arms straight and chest up.',
      'Push the floor away while keeping bar close to body.',
      'Lock out tall with glutes, not by leaning back.',
    ],
  },
  'single-leg-calf-raise': {
    steps: [
      'Stand on one foot on a step or floor, other foot hovering.',
      'Rise onto the ball of your foot as high as possible.',
      'Pause at the top.',
      'Lower slowly for a full stretch.',
    ],
  },
  running: {
    steps: [
      'Stand tall with a slight forward lean from ankles.',
      'Land mid-foot under your hips with quick, light steps.',
      'Drive elbows back at ~90° without crossing midline.',
      'Maintain steady breathing and relaxed shoulders.',
    ],
  },
  cycling: {
    steps: [
      'Set saddle height so knee has a slight bend at bottom.',
      'Keep core engaged and shoulders relaxed.',
      'Pedal smooth circles—push down and pull up lightly.',
      'Adjust resistance to maintain form over speed.',
    ],
  },
  rowing: {
    steps: [
      'Catch: arms extended, shins vertical, shoulders forward.',
      'Drive: push with legs first, then lean back slightly.',
      'Pull: draw handle to lower ribs with elbows past torso.',
      'Recovery: extend arms, hinge forward, then bend knees.',
    ],
  },
  swimming: {
    steps: [
      'Keep body long and horizontal in the water.',
      'Rotate from hips for freestyle, breathing to the side.',
      'Catch water early with a high elbow pull.',
      'Maintain a steady kick from hips, not knees only.',
    ],
  },
  'recovery-walk': {
    steps: [
      'Walk at an easy pace you can hold a conversation.',
      'Stand tall with relaxed arms.',
      'Land softly through mid-foot.',
      'Focus on nasal breathing and loosening tight areas.',
    ],
  },
};

function lookupBySlug(
  map: Record<string, ExerciseFormGuide>,
  slug: string | undefined,
  name: string | undefined,
): ExerciseFormGuide | null {
  if (slug && map[slug]) return map[slug];
  const key = normalizeKey(name);
  if (key && map[key]) return map[key];
  const catalog = catalogExerciseBySlug(key);
  if (catalog && map[catalog.slug]) return map[catalog.slug];
  return null;
}

export function resolveExerciseFormGuide(
  exercise?: Exercise | null,
  nameFallback?: string,
): ExerciseFormGuide | null {
  const name = exercise?.name ?? nameFallback ?? 'Exercise';
  const slug = exercise?.slug ?? normalizeKey(name);

  if (exercise?.instructions) {
    const fromDb = guideFromInstructions(exercise.instructions);
    if (fromDb?.steps?.length) {
      return enrichStepsToGuide(fromDb.steps, guideContext(exercise, name), fromDb.tips);
    }
    if (fromDb) return fromDb;
  }

  const structured = lookupBySlug(STRUCTURED_EXERCISE_GUIDES, slug, name);
  if (structured) {
    const enriched = buildExerciseEducation(exercise, name);
    return {
      ...enriched,
      ...structured,
      feelShould: structured.feelShould ?? enriched.feelShould,
      feelShouldNot: structured.feelShouldNot ?? enriched.feelShouldNot,
      musclesWorked: structured.musclesWorked ?? enriched.musclesWorked,
      illustratedSteps: structured.illustratedSteps,
    };
  }

  const generated = lookupBySlug(GENERATED_STRUCTURED_FORM_GUIDES, slug, name);
  if (generated) {
    const enriched = buildExerciseEducation(exercise, name);
    return {
      ...enriched,
      ...generated,
      feelShould: generated.feelShould ?? enriched.feelShould,
      feelShouldNot: generated.feelShouldNot ?? enriched.feelShouldNot,
      musclesWorked: generated.musclesWorked ?? enriched.musclesWorked,
      coachingCues: generated.coachingCues?.length ? generated.coachingCues : enriched.coachingCues,
      commonMistakes: generated.commonMistakes?.length
        ? generated.commonMistakes
        : enriched.commonMistakes,
    };
  }

  const legacy = lookupBySlug(LEGACY_STEPS_BY_SLUG, slug, name);
  if (legacy?.steps?.length) {
    const enriched = buildExerciseEducation(exercise, name);
    const legacyGuide = enrichStepsToGuide(legacy.steps, guideContext(exercise, name), legacy.tips);
    return {
      ...enriched,
      ...legacyGuide,
      summary: enriched.summary,
      musclesWorked: enriched.musclesWorked,
      equipmentRequired: enriched.equipmentRequired,
      feelShould: enriched.feelShould,
      feelShouldNot: enriched.feelShouldNot,
      coachingCues: enriched.coachingCues,
      commonMistakes: legacy.tips ?? enriched.commonMistakes,
      illustratedSteps: legacy.illustratedSteps,
    };
  }

  const month1Guide = month1GuideFromEncyclopedia(name);
  if (month1Guide) {
    const enriched = buildExerciseEducation(exercise, name);
    return {
      ...enriched,
      feelShould: month1Guide.feelLike ? [month1Guide.feelLike] : enriched.feelShould,
      coachingCues: enriched.coachingCues?.length ? enriched.coachingCues : month1Guide.cues,
      commonMistakes: month1Guide.commonMistakes?.length ? month1Guide.commonMistakes : enriched.commonMistakes,
      regressions: month1Guide.regressions?.length ? month1Guide.regressions : enriched.regressions,
      progressions: month1Guide.progressions?.length ? month1Guide.progressions : enriched.progressions,
      illustratedSteps: undefined,
    };
  }

  return buildExerciseEducation(exercise, name);
}

export function hasExerciseFormGuide(exercise?: Exercise | null, nameFallback?: string): boolean {
  return resolveExerciseFormGuide(exercise, nameFallback) != null;
}
