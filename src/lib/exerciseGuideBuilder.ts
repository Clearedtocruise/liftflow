import { catalogExerciseBySlug } from '@/constants/exerciseDatabase';
import type { ExerciseFormGuide } from '@/lib/exerciseGuideTypes';
import type { Exercise } from '@/types';
import type { MovementCategory } from '@/types/common';

function normalizeKey(value: string | undefined | null): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function humanize(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function muscleFocusLabel(muscles: string[] | undefined): string {
  if (!muscles?.length) return 'the working muscles';
  return muscles.slice(0, 3).join(', ');
}

export function describeEquipment(
  equipment: string,
  name: string,
  requires?: string[],
): string {
  const extras = requires?.filter((r) => r !== equipment && r !== 'bodyweight').map(humanize);
  const extraNote = extras?.length ? ` You also need: ${extras.join(', ')}.` : '';

  switch (equipment) {
    case 'barbell':
      return `Load a barbell with weight you can move for all reps with good form. Use collars.${extraNote} For ${name}, set the bar in the rack or on the floor as required.`;
    case 'dumbbell':
      return `Choose dumbbells you can control for the full set — err lighter if unsure.${extraNote || ' One dumbbell per hand unless the move is single-arm.'}`;
    case 'cable':
      return `Attach the appropriate handle to the cable stack. Start light to find the right height and path.${extraNote || ''}`;
    case 'machine':
      return `Adjust the seat, pads, and pins so joints line up with the machine's pivot points.${extraNote || ''}`;
    case 'bands':
      return `Use a band tension that challenges the last reps without breaking form. Anchor securely.${extraNote || ''}`;
    case 'kettlebell':
      return `Pick a kettlebell you can hold in the rack or hang position for all reps.${extraNote || ''}`;
    case 'bodyweight':
      return `No external weight — use bodyweight only.${extraNote || ' Add a weight belt or vest only if prescribed.'}`;
    default:
      return `Use ${humanize(equipment)} appropriate for ${name}.${extraNote}`;
  }
}

type GuideContext = {
  name: string;
  slug: string;
  category: MovementCategory;
  equipment: string;
  muscleGroups: string[];
  family?: string;
  requires?: string[];
};

function ctxFromExercise(exercise: Exercise | null | undefined, name: string): GuideContext {
  const slug = exercise?.slug ?? normalizeKey(name);
  const catalog = catalogExerciseBySlug(slug);
  return {
    name: exercise?.name ?? name,
    slug,
    category: exercise?.category ?? catalog?.movementCategory ?? 'other',
    equipment: exercise?.equipment ?? catalog?.equipment ?? 'bodyweight',
    muscleGroups: exercise?.muscleGroups ?? catalog?.muscleGroups ?? [],
    family: catalog?.metadata?.movement_family,
    requires: catalog?.metadata?.requires,
  };
}

function baseGuide(ctx: GuideContext, partial: Omit<ExerciseFormGuide, 'equipment'>): ExerciseFormGuide {
  return {
    equipment: describeEquipment(ctx.equipment, ctx.name, ctx.requires),
    ...partial,
  };
}

function matches(name: string, keywords: string[]): boolean {
  const n = name.toLowerCase();
  return keywords.some((k) => n.includes(k));
}

function isTricepExtension(name: string): boolean {
  if (matches(name, ['back extension', 'hyperextension', 'reverse hyper', 'good morning'])) return false;
  if (matches(name, ['leg extension', 'leg curl', 'hamstring curl'])) return false;
  if (matches(name, ['glute kickback', 'glute kick-back', 'donkey kick'])) return false;
  return matches(name, [
    'tricep',
    'triceps',
    'pushdown',
    'skull crusher',
    'skull-crusher',
    'kickback',
    'jm press',
    'overhead extension',
  ]);
}

function buildByPattern(ctx: GuideContext): ExerciseFormGuide {
  const { name, category, muscleGroups } = ctx;
  const focus = muscleFocusLabel(muscleGroups);

  if (matches(name, ['plank', 'hollow hold', 'dead hang', 'wall sit', 'l-sit', 'isometric'])) {
    return baseGuide(ctx, {
      setup: 'Place hands or forearms on the floor (or hang from the bar). Feet together or hip-width. Brace abs, glutes, and quads before you start the clock.',
      startPosition: 'Body in one straight line from head to heels (or fully hanging with shoulders engaged, not shrugged).',
      movement: 'Hold the position without letting hips sag, pike, or rotate. Breathe steadily in small breaths.',
      endPosition: 'End the set when form breaks — hips drop, lower back arches, or shoulders collapse.',
      muscleFocus: `Keep constant tension in ${focus}. You should feel stabilizers working, not strain in your lower back.`,
    });
  }

  if (matches(name, ['back extension', 'hyperextension', 'reverse hyper'])) {
    return baseGuide(ctx, {
      setup: 'Position hips on the pad with feet anchored. Torso free to hinge. Hands behind head, crossed on chest, or at temples.',
      startPosition: 'Upper body hanging down with a neutral spine — not rounded, not over-arched.',
      movement: 'Raise your torso by extending through the hips and lower back until your body forms a straight line with your legs.',
      endPosition: 'Pause briefly at the top with glutes and spinal erectors squeezed — do not hyperextend past neutral.',
      muscleFocus: 'Drive the lift from your glutes and lower back (erectors). Avoid jerking with momentum.',
    });
  }

  if (matches(name, ['crunch', 'sit-up', 'sit up', 'v-up', 'toes to bar', 'leg raise', 'dead bug', 'flutter', 'hanging leg'])) {
    return baseGuide(ctx, {
      setup: 'Lie on your back or hang from a bar as required. Press lower back toward the floor (or engage lats if hanging).',
      startPosition: 'Ribs stacked over pelvis, neck relaxed, core braced before moving.',
      movement: 'Curl or lift using your abs — exhale on the effort. Move slowly without pulling on your neck or swinging.',
      endPosition: 'Peak contraction when abs are fully shortened; lower with control to the start.',
      muscleFocus: `Exhale and squeeze ${focus} at the top. If your lower back takes over, shorten the range.`,
    });
  }

  if (matches(name, ['twist', 'rotation', 'wood chop', 'pallof', 'bicycle', 'oblique', 'russian twist'])) {
    return baseGuide(ctx, {
      setup: 'Feet shoulder-width or kneeling with hips square. Hold weight at chest or cable at chest height.',
      startPosition: 'Torso facing forward, core braced, shoulders level.',
      movement: 'Rotate through your ribcage and obliques — not by twisting your lower back. Control the weight both directions.',
      endPosition: 'Finish each rep centered or on the opposite side; resist the weight pulling you off balance.',
      muscleFocus: `Feel ${focus} resisting rotation. Hips stay stable unless the drill calls for hip turn.`,
    });
  }

  if (matches(name, ['reverse fly', 'rear delt fly', 'rear-delt fly'])) {
    return baseGuide(ctx, {
      setup: 'Hinge forward with flat back, or use a pec-deck/reverse fly machine with chest on the pad. Hold dumbbells or cables with palms facing each other.',
      startPosition: 'Arms hanging below shoulders with a soft bend in elbows — not straight, not 90°.',
      movement: 'Raise arms out to the sides in a wide arc, leading with elbows and squeezing shoulder blades together.',
      endPosition: 'Pause when upper arms are parallel to the floor and rear delts are fully contracted.',
      muscleFocus: 'Rear delts and rhomboids — not chest, not biceps. Squeeze shoulder blades together at the top.',
      commonMistakes: ['Turning this into a chest fly or row', 'Shrugging traps to lift the weight', 'Swinging torso for momentum'],
      coachingCues: ['Lead with elbows', 'Squeeze shoulder blades', 'Keep chest still'],
    });
  }

  if (matches(name, ['neck'])) {
    return baseGuide(ctx, {
      setup: 'Sit or stand with tall posture. Use a harness, light plate, or hands for gentle resistance only — start very light.',
      startPosition: 'Head in neutral alignment over shoulders. Move slowly through a controlled range.',
      movement: 'Flex, extend, or rotate the neck against light resistance as prescribed — small ranges only.',
      endPosition: 'Return to neutral without jerking. Never force end range.',
      muscleFocus: 'Neck flexors/extensors working evenly. Stop immediately if you feel sharp pain or dizziness.',
      commonMistakes: ['Using heavy weight', 'Jerking through range', 'Holding breath or clenching jaw'],
      coachingCues: ['Small controlled range', 'Light resistance only', 'Stop if any sharp pain'],
    });
  }

  if (matches(name, ['thruster', 'man maker', 'clean and press', 'squat to press']) || (matches(name, ['interval']) && matches(name, ['thruster', 'dumbbell', 'db']))) {
    return baseGuide(ctx, {
      setup: 'Hold dumbbells, kettlebells, or a barbell at shoulder height (front rack). Feet shoulder-width. For intervals, set work/rest timing before you start.',
      startPosition: 'Core braced, elbows under the weight, hips ready to squat.',
      movement: 'Squat to depth, then drive up explosively and press the weight overhead in one fluid motion. Repeat for the work interval.',
      endPosition: 'Stand tall with arms locked overhead over mid-foot. Lower weight to shoulders during rest.',
      muscleFocus: 'Legs initiate the drive; shoulders and triceps finish the press. Cardio demand builds across intervals — keep form over speed.',
      commonMistakes: ['Pressing before hips fully extend', 'Using weight too heavy to squat safely', 'Dropping form to beat the clock'],
      coachingCues: ['Squat first, then press', 'Drive through mid-foot', 'Use dumbbells for load'],
    });
  }

  if (matches(name, ['lateral raise', 'front raise', 'rear delt raise'])) {
    return baseGuide(ctx, {
      setup: 'Stand tall with dumbbells or cables at your sides. Slight bend in elbows, core braced.',
      startPosition: 'Arms at your sides, palms facing in or slightly forward, shoulders down.',
      movement: 'Raise arms out to the sides until upper arms are parallel to the floor — lead with elbows, not hands.',
      endPosition: 'Pause at shoulder height; lower slowly without swinging or leaning back.',
      muscleFocus: 'Side delts do the work — not traps or momentum. Keep torso still.',
      commonMistakes: ['Shrugging weight up', 'Swinging torso', 'Bending elbows past 90°'],
      coachingCues: ['Lead with elbows', 'Stop at shoulder height', 'Control the descent'],
    });
  }

  if (matches(name, ['shrug'])) {
    return baseGuide(ctx, {
      setup: 'Hold dumbbells, barbell, or trap bar at arm\'s length. Stand tall with shoulders down before you start.',
      startPosition: 'Arms straight, traps relaxed, gaze forward.',
      movement: 'Elevate shoulders straight up toward your ears — do not roll shoulders.',
      endPosition: 'Squeeze traps at the top briefly; lower with control.',
      muscleFocus: 'Upper traps — straight up and down path. Keep arms straight.',
      commonMistakes: ['Rolling shoulders', 'Bending elbows', 'Using hip thrust to move weight'],
      coachingCues: ['Straight up', 'Pause at top', 'Arms stay long'],
    });
  }

  if (
    matches(name, ['row', 'pulldown', 'pull-up', 'pull up', 'pullup', 'chin-up', 'chin up', 'lat pull']) ||
    (category === 'pull' && !matches(name, ['reverse fly', 'rear delt']))
  ) {
    const vertical = matches(name, ['pulldown', 'pull-up', 'pull up', 'pullup', 'chin']);
    return baseGuide(ctx, {
      setup: vertical
        ? 'Grip the bar slightly wider than shoulders. Thighs secured under pads if seated. Chest lifted.'
        : 'Hinge forward with flat back, or brace on a bench for single-arm rows. Feet planted.',
      startPosition: vertical
        ? 'Arms extended overhead with shoulders depressed — not shrugged.'
        : 'Arms hanging straight down, shoulder blades neutral, spine neutral.',
      movement: vertical
        ? 'Pull elbows down and back toward your ribs until the bar reaches upper chest.'
        : 'Drive elbows toward your back pockets, pulling the weight to your lower ribs or hip.',
      endPosition: 'Squeeze shoulder blades together at the finish; lower with control to full stretch.',
      muscleFocus: `Lead with ${focus} — think "elbows to pockets," not hands. Avoid shrugging.`,
    });
  }

  if (matches(name, ['curl']) && !matches(name, ['leg curl', 'tricep', 'hamstring'])) {
    return baseGuide(ctx, {
      setup: 'Stand tall or sit on a bench. Shoulders down and back, chest up, core braced.',
      startPosition: 'Arms fully extended at your sides (or on preacher pad) with elbows fixed in place.',
      movement: 'Curl the weight up in an arc without swinging your torso or shoulders forward.',
      endPosition: 'Squeeze at the top with biceps fully shortened, then lower slowly to full extension.',
      muscleFocus: `Pin elbows — only your forearms move. Peak squeeze in ${focus}.`,
    });
  }

  if (isTricepExtension(name) || matches(name, ['dip', 'jm press'])) {
    return baseGuide(ctx, {
      setup: 'Stand at cable, lie on bench, or support on parallel bars. Shoulders down and back.',
      startPosition: 'Elbows bent with upper arms fixed — tucked to ribs for pushdowns, vertical for skull crushers.',
      movement: 'Extend elbows to straighten arms on a controlled path. Do not let elbows flare or drift forward.',
      endPosition: 'Arms straight but not violently locked; shoulders stay packed.',
      muscleFocus: `Focus on ${focus} contracting through the extension. Upper arms stay still.`,
    });
  }

  if (matches(name, ['face pull', 'pull-apart', 'pull apart'])) {
    return baseGuide(ctx, {
      setup: 'Set cable or band at face height. Staggered stance, core braced.',
      startPosition: 'Arms extended with shoulders down, palms facing each other.',
      movement: 'Pull toward your face with elbows high and wide. Externally rotate at the end.',
      endPosition: 'Hands near ears, shoulder blades squeezed, wrists in line with forearms.',
      muscleFocus: 'Rear delts and mid-back — not your biceps doing the work.',
    });
  }

  if (matches(name, ['fly', 'crossover', 'pec deck']) || (matches(name, ['raise']) && !matches(name, ['calf', 'leg', 'lateral', 'front', 'rear']))) {
    return baseGuide(ctx, {
      setup: 'Set cables or hold dumbbells. Slight bend in elbows that stays fixed throughout.',
      startPosition: 'Arms open to a comfortable stretch — chest tall, shoulders down.',
      movement: 'Bring hands together in a wide hugging arc without changing elbow angle.',
      endPosition: 'Brief pause when you feel chest contract; return slowly to the stretch.',
      muscleFocus: `Squeeze ${focus} at the top. Do not turn this into a press.`,
    });
  }

  if (matches(name, ['press', 'push-up', 'push up', 'bench', 'floor press']) || category === 'push') {
    return baseGuide(ctx, {
      setup: 'Feet flat on floor (or body in plank line for push-ups). Shoulder blades pulled back and down.',
      startPosition: 'Weight at chest or shoulder line, wrists stacked over elbows, core braced.',
      movement: 'Lower with control to chest or shoulder line — elbows ~45° from torso.',
      endPosition: 'Press back up in a slight arc to lockout without losing shoulder position.',
      muscleFocus: `Drive through ${focus}. Keep glutes and core tight on bench; full body rigid on push-ups.`,
    });
  }

  if (matches(name, ['lunge', 'split squat', 'step-up', 'step up']) || ctx.family === 'lunge_pattern') {
    return baseGuide(ctx, {
      setup: 'Stand tall, feet hip-width. Hold weights at sides or in rack position if loaded.',
      startPosition: 'Weight on both feet evenly before stepping.',
      movement: 'Step forward, back, or to the side — lower until both knees bend ~90° with front knee over mid-foot.',
      endPosition: 'Drive through the front foot to return to standing; alternate legs as programmed.',
      muscleFocus: `Front leg does the work in ${focus}. Torso upright — no leaning forward.`,
      coachingCues: ['Front knee tracks toes', 'Torso tall', 'Push through front mid-foot'],
      commonMistakes: ['Knee collapsing inward', 'Leaning torso forward', 'Shortening the step'],
    });
  }

  if (matches(name, ['glute kickback', 'glute kick-back', 'donkey kick'])) {
    return baseGuide(ctx, {
      setup: 'Use a cable ankle strap or get on all fours. Keep hips square to the floor or machine.',
      startPosition: 'Working leg slightly bent, glute engaged before moving.',
      movement: 'Drive the heel back and up by squeezing the glute — small controlled arc, not a swing.',
      endPosition: 'Peak squeeze with hip extended; return slowly without letting the weight yank you.',
      muscleFocus: 'Glute does the work. Lower back stays quiet — do not arch to finish the rep.',
      coachingCues: ['Heel drives back', 'Hips stay square', 'Squeeze at the top'],
      commonMistakes: ['Arching the lower back', 'Using momentum', 'Turning into a hamstring curl'],
    });
  }

  if (matches(name, ['nordic'])) {
    return baseGuide(ctx, {
      setup: 'Kneel with ankles secured under a pad, partner, or Nordic bench. Tall torso, hips extended.',
      startPosition: 'Knees on pad, body in a straight line from knees to head, arms ready to catch.',
      movement: 'Slowly lower your torso forward by resisting with hamstrings — hips stay extended.',
      endPosition: 'Catch yourself with hands near the floor if needed, then pull back up with hamstrings (or assist).',
      muscleFocus: 'Hamstrings eccentrically control the descent. Do not fold at the hips.',
      coachingCues: ['Hips locked forward', 'Slow lower', 'Brace abs'],
      commonMistakes: ['Piking at the hips', 'Dropping too fast', 'Rounding the upper back'],
    });
  }

  if (matches(name, ['squat', 'leg press', 'hack squat', 'goblet']) || category === 'squat') {
    return baseGuide(ctx, {
      setup: 'Feet shoulder-width, toes slightly out. Bar on back, dumbbell at chest, or feet on leg press platform.',
      startPosition: 'Stand tall, big breath, brace core, hips and knees ready to bend together.',
      movement: 'Sit hips down and back keeping chest up. Descend to parallel or as deep as form allows.',
      endPosition: 'Drive through mid-foot to stand — knees track over toes, spine stays neutral.',
      muscleFocus: `Feel ${focus} on the way up. "Spread the floor" with your feet for knee stability.`,
    });
  }

  if (
    matches(name, ['rdl', 'deadlift', 'good morning', 'hip thrust', 'glute bridge', 'swing', 'pull through', 'pull-through', 'leg curl', 'hamstring']) ||
    category === 'hinge'
  ) {
    if (matches(name, ['leg curl', 'hamstring curl'])) {
      return baseGuide(ctx, {
        setup: 'Align knee joint with machine pivot. Pad on lower calf/achilles.',
        startPosition: 'Legs extended, hips pressed into pad, torso stable.',
        movement: 'Curl heels toward glutes in a smooth arc without lifting hips.',
        endPosition: 'Squeeze hamstrings at top; lower slowly without slamming weight.',
        muscleFocus: 'Hamstrings do the work — hips stay still.',
      });
    }
    return baseGuide(ctx, {
      setup: 'Feet hip-width, soft knee bend. Bar, dumbbells, or landmine close to body.',
      startPosition: 'Hips high, spine neutral, shoulders over or slightly ahead of the load.',
      movement: 'Push hips back (hinge) keeping load close to legs. Stop when hamstrings stretch.',
      endPosition: 'Drive hips forward to stand tall — squeeze glutes at top, not lower back.',
      muscleFocus: `Load ${focus} — hamstrings on the way down, glutes to finish. Flat back always.`,
    });
  }

  if (matches(name, ['carry', 'farmer', 'yoke', 'suitcase', 'zercher', 'walk']) || category === 'carry') {
    const farmer = matches(name, ['farmer']);
    return baseGuide(ctx, {
      setup: 'Pick up weights with neutral spine. Stand tall before moving.',
      startPosition: 'Shoulders level, ribs stacked over pelvis, gaze forward.',
      movement: farmer
        ? 'Walk with short, controlled steps. Keep shoulders level and core braced for the full carry.'
        : 'Short, quick steps. Do not lean or let weights pull you sideways.',
      endPosition: 'Set weights down with a controlled squat or hinge — do not drop from standing.',
      muscleFocus: farmer
        ? 'Grip and traps working hard; core stays tight. Shoulders stay packed, not shrugged.'
        : 'Core and grip stay tight. Shoulders packed, not shrugged.',
    });
  }

  if (matches(name, ['calf']) || (matches(name, ['raise']) && matches(name, ['calf', 'toe']))) {
    return baseGuide(ctx, {
      setup: 'Balls of feet on platform or floor, heels free to drop.',
      startPosition: 'Heels below parallel for a stretch at the bottom.',
      movement: 'Rise onto toes as high as possible — pause at the top.',
      endPosition: 'Lower slowly for a full stretch before the next rep.',
      muscleFocus: 'Full range in calves — no bouncing at the bottom.',
    });
  }

  if (matches(name, ['leg extension'])) {
    return baseGuide(ctx, {
      setup: 'Align knee with machine pivot. Back flat against pad.',
      startPosition: 'Shins behind pad, knees bent ~90°.',
      movement: 'Extend knees to straighten legs without kicking or swinging.',
      endPosition: 'Squeeze quads at top; lower with control.',
      muscleFocus: 'Quads only — hips stay glued to the seat.',
    });
  }

  if (category === 'cardio' || matches(name, ['run', 'sprint', 'row', 'cycle', 'bike', 'swim', 'burpee', 'jump rope', 'interval'])) {
    return baseGuide(ctx, {
      setup: 'Start at easy effort. Posture tall, shoulders relaxed.',
      startPosition: 'Rhythm established before building intensity.',
      movement: 'Maintain steady form as effort increases — do not sacrifice technique for speed.',
      endPosition: 'Cool down gradually; do not stop abruptly from high intensity.',
      muscleFocus: 'Breathe steadily. Stop if form breaks or pain appears.',
    });
  }

  if (category === 'core') {
    return baseGuide(ctx, {
      setup: 'Stable base — feet or hips anchored as needed. Brace core before moving.',
      startPosition: 'Spine neutral, ribs down, no arching lower back.',
      movement: 'Move through range slowly with control. Exhale on the hardest phase.',
      endPosition: 'Return to start without losing spinal position.',
      muscleFocus: `Feel ${focus} working — not hip flexors or lower back compensating.`,
    });
  }

  return baseGuide(ctx, {
    setup: 'Feet planted shoulder-width, core braced, shoulders relaxed and down.',
    startPosition: 'Neutral spine, stable base, load in the starting position for this movement.',
    movement: 'Move through the full range with control — no bouncing or momentum.',
    endPosition: 'Return slowly to the start before the next rep.',
    muscleFocus: `Maintain tension in ${focus} throughout each rep.`,
  });
}

/** Upgrade legacy 4-step guides using exercise context */
export function enrichLegacyGuide(
  steps: string[],
  ctx: GuideContext,
  tips?: string[],
): ExerciseFormGuide {
  const focus =
    tips?.join(' ') ??
    `Focus on controlled reps. Primary muscles: ${muscleFocusLabel(ctx.muscleGroups)}.`;

  return {
    equipment: describeEquipment(ctx.equipment, ctx.name, ctx.requires),
    setup: steps[0],
    startPosition: steps[0],
    movement: steps.length > 2 ? `${steps[1]} ${steps[2]}` : steps[1] ?? steps[0],
    endPosition: steps[steps.length - 1],
    muscleFocus: focus,
    tips,
  };
}

export function buildExerciseGuide(
  exercise: Exercise | null | undefined,
  nameFallback?: string,
): ExerciseFormGuide {
  const name = exercise?.name ?? nameFallback ?? 'Exercise';
  const ctx = ctxFromExercise(exercise, name);
  return buildByPattern(ctx);
}
