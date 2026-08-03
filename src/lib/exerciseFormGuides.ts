import { FAMILY_GUIDES, MOVEMENT_FAMILY_LABELS } from '@/lib/exerciseFamilyGuides';
import { resolveMovementFamily } from '@/lib/exerciseMovementFamily';
import { month1GuideFromEncyclopedia } from '@/lib/liftingReference/month1ExerciseEncyclopedia';
import type { Exercise } from '@/types';
import type { MovementCategory } from '@/types/common';

export type ExerciseFormGuide = {
  steps: string[];
  tips?: string[];
  /** Lets the UI distinguish reviewed/specific content from pattern or category guidance. */
  source?: 'authored' | 'instructions' | 'encyclopedia' | 'family' | 'category';
  /** Pattern and category guidance are useful, but must not be presented as exercise-specific expertise. */
  isGeneral?: boolean;
  /** Names the movement pattern behind `family` guidance, e.g. "triceps isolation". */
  familyLabel?: string;
};

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

const GUIDES_BY_SLUG: Record<string, ExerciseFormGuide> = {
  'bench-press': {
    steps: [
      'Lie on the bench with eyes under the bar, feet flat, and shoulder blades pulled back.',
      'Grip slightly wider than shoulder width and unrack with straight wrists.',
      'Lower the bar to mid-chest with elbows at roughly 45°.',
      'Press up in a slight arc until arms are extended without locking elbows hard.',
    ],
    tips: ['Keep glutes and upper back pinned to the bench.', 'Drive through your legs for stability.'],
  },
  'incline-bench-press': {
    steps: [
      'Set the bench to 30–45° and sit with feet planted.',
      'Grip the bar slightly wider than shoulders and unrack over upper chest.',
      'Lower to the upper chest/clavicle line with controlled elbows.',
      'Press up and slightly back to the start position.',
    ],
  },
  'overhead-press': {
    steps: [
      'Stand with the bar at collarbone height, grip just outside shoulders.',
      'Brace your core and squeeze glutes.',
      'Press the bar straight up, moving your head back slightly to clear the path.',
      'Lock out overhead with biceps near ears, then return under control.',
    ],
  },
  squat: {
    steps: [
      'Set the bar on your upper back, feet shoulder-width, toes slightly out.',
      'Brace your core, take a breath, and break at hips and knees together.',
      'Descend until thighs are at least parallel while keeping chest up.',
      'Drive through mid-foot to stand, keeping knees tracking over toes.',
    ],
    tips: ['Keep heels down and avoid collapsing forward.', 'Think “spread the floor” with your feet.'],
  },
  'front-squat': {
    steps: [
      'Rest the bar on front delts with elbows high and fingers under the bar.',
      'Stand tall, brace, and sit straight down between your hips.',
      'Keep torso upright as you descend to parallel or below.',
      'Drive up through mid-foot while keeping elbows from dropping.',
    ],
  },
  deadlift: {
    steps: [
      'Stand with mid-foot under the bar, feet hip-width.',
      'Hinge and grip just outside your legs with a flat back.',
      'Pull slack out of the bar, brace, and push the floor away.',
      'Stand tall with hips and shoulders rising together; reverse under control.',
    ],
    tips: ['Keep the bar close to your shins and thighs.', 'Do not round your lower back.'],
  },
  'romanian-deadlift': {
    steps: [
      'Hold the bar at hip height with a soft knee bend.',
      'Push hips back while keeping the bar close to your legs.',
      'Stop when you feel a strong hamstring stretch with a flat back.',
      'Drive hips forward to return to standing.',
    ],
  },
  'barbell-row': {
    steps: [
      'Hinge forward with a flat back, bar hanging at arm’s length.',
      'Pull the bar to your lower ribs by driving elbows back.',
      'Squeeze shoulder blades together at the top.',
      'Lower with control without losing your hinge position.',
    ],
  },
  'lat-pulldown': {
    steps: [
      'Sit with thighs secured, grip the bar slightly wider than shoulders.',
      'Start with arms extended and chest lifted.',
      'Pull the bar to upper chest by driving elbows down and back.',
      'Return slowly until arms are extended without shrugging.',
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
  'leg-press': {
    steps: [
      'Sit with back and hips flat against the pad, feet shoulder-width on the platform.',
      'Unlock the sled and lower until knees reach about 90° without butt lifting.',
      'Press through mid-foot to extend legs without locking knees hard.',
      'Keep knees tracking over toes throughout.',
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
  'dumbbell-row': {
    steps: [
      'Place one hand and knee on a bench, other foot on the floor.',
      'Let the dumbbell hang straight down with a flat back.',
      'Row to your hip, driving elbow back.',
      'Lower fully without twisting your torso.',
    ],
  },
  'goblet-squat': {
    steps: [
      'Hold a dumbbell or kettlebell at chest height with elbows in.',
      'Feet shoulder-width, toes slightly out.',
      'Squat between your hips keeping chest tall.',
      'Drive up through mid-foot to stand.',
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
  'bulgarian-split-squat': {
    steps: [
      'Place rear foot on a bench, front foot far enough forward to lunge comfortably.',
      'Lower straight down until front thigh is parallel.',
      'Keep torso slightly forward and front knee stable.',
      'Drive through the front foot to stand.',
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
  'hip-thrust': {
    steps: [
      'Upper back on a bench, bar over hips with padding.',
      'Feet flat, knees bent ~90° at the top.',
      'Drive hips up until torso and thighs form a straight line.',
      'Squeeze glutes at the top, then lower without losing tension.',
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
  'pull-up': {
    steps: [
      'Hang from the bar with hands slightly wider than shoulders, palms away.',
      'Depress shoulder blades and brace core.',
      'Pull chest toward the bar by driving elbows down.',
      'Lower with control to a full hang.',
    ],
    tips: ['Avoid kipping unless programmed.', 'Think “pull elbows to pockets.”'],
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
  'push-up': {
    steps: [
      'Hands slightly wider than shoulders, body in a straight line from head to heels.',
      'Lower chest toward the floor with elbows at ~45°.',
      'Touch or come close without sagging hips.',
      'Press back up while maintaining a rigid plank.',
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
  'plank': {
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
  'face-pull': {
    steps: [
      'Set cable at face height with a rope attachment.',
      'Pull toward your face with elbows high and wide.',
      'Externally rotate at the end so hands end near ears.',
      'Return with control, keeping shoulders down.',
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

const GENERIC_BY_CATEGORY: Partial<Record<MovementCategory, ExerciseFormGuide>> = {
  push: {
    steps: [
      'Set your base: stable feet, braced core, shoulders down and back.',
      'Move through the full range with control—no bouncing or jerking.',
      'Keep tension on the target muscles throughout the rep.',
      'Return to the start position slowly before the next rep.',
    ],
  },
  pull: {
    steps: [
      'Start with shoulders set down and back, core braced.',
      'Initiate the pull by driving elbows toward your hips or ribs.',
      'Squeeze the target muscles at the end range.',
      'Lower the weight under control to full extension.',
    ],
  },
  squat: {
    steps: [
      'Feet planted, core braced, chest up.',
      'Sit hips down and back while knees track over toes.',
      'Descend to comfortable depth with a neutral spine.',
      'Drive through mid-foot to stand tall.',
    ],
  },
  hinge: {
    steps: [
      'Soft knee bend, hips back, flat back.',
      'Keep the load close to your body as you hinge.',
      'Stop when you feel hamstrings/glutes load—not lower back strain.',
      'Drive hips forward to return upright.',
    ],
  },
  core: {
    steps: [
      'Brace your core as if preparing for a light punch to the stomach.',
      'Move slowly and stay in a neutral spine unless the drill says otherwise.',
      'Breathe steadily—don’t hold your breath the entire rep.',
      'Stop if form breaks; quality beats duration or reps.',
    ],
  },
  cardio: {
    steps: [
      'Start easy and build rhythm before increasing intensity.',
      'Maintain upright posture and relaxed shoulders.',
      'Use steady breathing matched to your effort level.',
      'Cool down gradually rather than stopping abruptly.',
    ],
  },
  carry: {
    steps: [
      'Pick up the load with a tall posture and braced core.',
      'Take short, controlled steps without leaning or twisting.',
      'Keep shoulders level and ribs stacked over pelvis.',
      'Walk the prescribed distance or time, then lower safely.',
    ],
  },
  other: {
    steps: [
      'Set a stable base with feet planted and core braced.',
      'Move through the full range with control.',
      'Keep tension on the working muscles throughout.',
      'Return to the start position slowly before the next rep.',
    ],
  },
};

const SUPPORT_BY_CATEGORY: Record<
  MovementCategory,
  { breathing: string; avoid: string; easier: string; harder: string }
> = {
  push: {
    breathing: 'Inhale during the controlled return; exhale as you press through the effort.',
    avoid: 'Avoid flaring or shrugging the shoulders, bouncing the load, or losing your brace.',
    easier: 'Easier: reduce the load or range of motion until every rep stays controlled.',
    harder: 'Harder: add load only after you can repeat the full range without changing position.',
  },
  pull: {
    breathing: 'Inhale as the arms lengthen; exhale as you pull and squeeze the target muscles.',
    avoid: 'Avoid jerking the load, shrugging, or turning the pull into a lower-back swing.',
    easier: 'Easier: reduce the load and use a supported position.',
    harder: 'Harder: add load or a brief squeeze only while the torso remains stable.',
  },
  squat: {
    breathing: 'Inhale and brace before descending; exhale after you drive through the hardest point.',
    avoid: 'Avoid heels lifting, knees collapsing inward, or losing a neutral, braced torso.',
    easier: 'Easier: reduce depth or load and use support until balance and control improve.',
    harder: 'Harder: add depth or load gradually without changing knee or torso position.',
  },
  hinge: {
    breathing: 'Inhale and brace before the hinge; exhale as the hips drive back to standing.',
    avoid: 'Avoid rounding the back, squatting the hinge, or letting the load drift away from you.',
    easier: 'Easier: shorten the range and reduce load until the hips move without spinal motion.',
    harder: 'Harder: add load or range only while the back stays neutral and the load stays close.',
  },
  core: {
    breathing: 'Breathe behind the brace—use slow exhales without letting the trunk lose position.',
    avoid: 'Avoid rushing, holding your breath for the whole set, or continuing after posture breaks.',
    easier: 'Easier: shorten the lever, reduce the range, or use a supported variation.',
    harder: 'Harder: lengthen the lever or add time before adding external load.',
  },
  cardio: {
    breathing: 'Use steady breathing matched to the effort; you should recover as intensity drops.',
    avoid: 'Avoid jumping straight to maximal effort or letting posture collapse as fatigue rises.',
    easier: 'Easier: reduce pace, resistance, incline, or work interval.',
    harder: 'Harder: increase one variable at a time—pace, resistance, incline, or duration.',
  },
  carry: {
    breathing: 'Breathe in short, controlled cycles behind a firm brace while keeping ribs stacked over the pelvis.',
    avoid: 'Avoid leaning, rushing the steps, shrugging, or letting the load pull you out of position.',
    easier: 'Easier: reduce the load or distance and carry with two hands.',
    harder: 'Harder: add distance or load while keeping the same posture and walking speed.',
  },
  other: {
    breathing: 'Exhale through the effort and inhale during the controlled return without losing your brace.',
    avoid: 'Avoid momentum, painful range, and any rep that changes your setup or joint position.',
    easier: 'Easier: reduce the load, range, speed, or balance demand.',
    harder: 'Harder: progress only one variable at a time after the movement is repeatable.',
  },
};

function enrichGuide(
  guide: ExerciseFormGuide,
  category: MovementCategory,
): ExerciseFormGuide {
  const support = SUPPORT_BY_CATEGORY[category] ?? SUPPORT_BY_CATEGORY.other;
  const all = [...guide.steps, ...(guide.tips ?? [])];
  const has = (pattern: RegExp) => all.some((line) => pattern.test(line));

  const steps = [...guide.steps];
  const tips = [...(guide.tips ?? [])];

  if (!has(/\b(inhale|exhale|breathe|breathing)\b/i)) steps.push(support.breathing);
  if (!has(/^(avoid|do\s*not|don't|never)\b/i)) tips.push(support.avoid);
  if (!has(/^(easier|regress|make\s*it\s*easier)\b/i)) tips.push(support.easier);
  if (!has(/^(harder|progress|make\s*it\s*harder)\b/i)) tips.push(support.harder);

  return { ...guide, steps, tips };
}

export function resolveExerciseFormGuide(
  exercise?: Exercise | null,
  nameFallback?: string,
): ExerciseFormGuide | null {
  const name = exercise?.name ?? nameFallback;
  const slug = exercise?.slug ?? normalizeKey(name);
  const category = exercise?.category ?? 'other';

  if (exercise?.instructions) {
    const fromDb = guideFromInstructions(exercise.instructions);
    if (fromDb) {
      return enrichGuide(
        { ...fromDb, source: 'instructions' },
        category,
      );
    }
  }

  // A hand-authored exact guide is the most specific content in the app. It must beat a broad
  // encyclopedia entry whose keyword fallback can return generic core/push/pull instructions.
  const authored =
    (slug ? GUIDES_BY_SLUG[slug] : undefined) ??
    GUIDES_BY_SLUG[normalizeKey(name)];
  if (authored) {
    return enrichGuide({ ...authored, source: 'authored' }, category);
  }

  const month1Guide = month1GuideFromEncyclopedia(name ?? '', { exactOnly: true });
  if (month1Guide?.execution?.length) {
    return enrichGuide({
      steps: [
        ...(month1Guide.setup ?? []),
        ...month1Guide.execution,
        ...(month1Guide.breathing ? [month1Guide.breathing] : []),
      ],
      tips: [
        ...(month1Guide.cues ?? []),
        ...(month1Guide.commonMistakes ?? []),
        ...(month1Guide.regressions ?? []),
        ...(month1Guide.progressions ?? []),
      ].filter(Boolean),
      source: 'encyclopedia',
    }, category);
  }

  // Pattern guidance is accurate for every exercise that genuinely belongs to the family, and it
  // is far more useful than broad category text. The family is derived from the exercise name
  // rather than the stored metadata, which mislabels kickbacks and burpees.
  const family = resolveMovementFamily({
    name,
    slug,
    category,
    equipment: exercise?.equipment,
    muscleGroups: exercise?.muscleGroups,
  });
  if (family) {
    return enrichGuide(
      {
        ...FAMILY_GUIDES[family],
        source: 'family',
        isGeneral: true,
        familyLabel: MOVEMENT_FAMILY_LABELS[family],
      },
      category,
    );
  }

  const fallback = GENERIC_BY_CATEGORY[category] ?? GENERIC_BY_CATEGORY.other;
  if (!fallback) return null;
  return enrichGuide(
    { ...fallback, source: 'category', isGeneral: true },
    category,
  );
}

export function hasExerciseFormGuide(exercise?: Exercise | null, nameFallback?: string): boolean {
  return resolveExerciseFormGuide(exercise, nameFallback) != null;
}
