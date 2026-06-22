import type { ExerciseFormGuide } from '@/lib/exerciseGuideTypes';

/** Hand-authored structured guides for common lifts — overrides generic templates */
export const STRUCTURED_EXERCISE_GUIDES: Record<string, ExerciseFormGuide> = {
  'bench-press': {
    equipment:
      'Barbell on a flat bench in a rack. Load weight with collars. Grip rings help align hands evenly.',
    setup:
      'Lie on the bench with eyes directly under the bar. Feet flat on the floor — not on tiptoes. Pull shoulder blades together and down; slight arch in upper back is fine. Glutes stay on the bench.',
    startPosition:
      'Grip the bar slightly wider than shoulder width, wrists straight (knuckles up). Unrack to arms extended over mid-chest — bar stacked over shoulders.',
    movement:
      'Inhale and lower the bar to mid-chest (nipple line) with elbows at roughly 45° from your torso. Touch lightly — no bounce.',
    endPosition:
      'Press the bar up in a slight arc back over your shoulders. Exhale at the top. Stop just short of slamming elbows into lockout.',
    muscleFocus:
      'Feel chest and front delts pressing; triceps finish the lockout. Drive legs into the floor for stability — "leg drive" without lifting hips.',
    tips: ['Keep glutes and upper back pinned.', 'Bar path: down to chest, up toward shoulders.'],
  },
  squat: {
    equipment: 'Barbell in a squat rack. Set safety pins just below your bottom depth. Load collars on both sides.',
    setup:
      'Bar on upper traps (high bar) or rear delts (low bar). Feet shoulder-width, toes out 15–30°. Brace core, big breath into belly.',
    startPosition: 'Stand tall with chest up, knees unlocked, bar balanced over mid-foot.',
    movement:
      'Break at hips and knees together. Sit between your hips — not straight down. Keep chest up and knees tracking over toes.',
    endPosition:
      'Descend until hip crease is at or below knee (parallel+). Drive through mid-foot to stand — hips and chest rise together.',
    muscleFocus:
      'Quads and glutes do the work. Feel the floor push back. "Spread the floor" with your feet to keep knees from caving.',
    tips: ['Heels down always.', 'Do not let lower back round at the bottom.'],
  },
  deadlift: {
    equipment:
      'Barbell on the floor with plates that put the bar at mid-shin height. Use a mixed or double overhand grip; straps optional on high-rep sets.',
    setup:
      'Stand with mid-foot under the bar (laces over bar). Feet hip-width, toes slightly out. Hinge and grip just outside your legs.',
    startPosition:
      'Flat back, chest up, shoulders slightly ahead of the bar. Pull slack out of the bar — feel tension before you pull.',
    movement:
      'Push the floor away with your legs. Bar stays in contact with shins and thighs. Hips and shoulders rise at the same rate.',
    endPosition:
      'Stand tall at lockout — hips forward, shoulders back, knees straight. Reverse the motion: hips back first, bar close to legs.',
    muscleFocus:
      'Hamstrings and glutes initiate; back stays rigid as a lever. Squeeze glutes at the top — do not hyperextend by leaning back.',
    tips: ['Bar close always.', 'Never round your lower back under load.'],
  },
  'romanian-deadlift': {
    equipment: 'Barbell or dumbbells. Start lighter than your deadlift — this is a stretch and hinge, not a max pull from the floor.',
    setup: 'Feet hip-width, soft bend in knees (not squatting). Bar at hip height or hang at arms length.',
    startPosition: 'Tall posture, shoulders packed, lats engaged to keep bar close.',
    movement:
      'Push hips straight back. Bar slides down your thighs and shins. Knees stay at the same slight bend — they do not travel forward.',
    endPosition:
      'Stop when hamstrings are fully stretched and back is still flat — usually mid-shin. Drive hips forward to stand.',
    muscleFocus: 'Hamstrings stretch on the way down; glutes finish the rep. You should not feel this in your lower back.',
  },
  'overhead-press': {
    equipment: 'Barbell in a rack at collarbone height, or dumbbells/kettlebells at shoulders.',
    setup:
      'Stand feet hip-width, glutes and abs tight. Bar at upper chest / front delts. Wrists straight, elbows slightly in front of the bar.',
    startPosition: 'Ribs down, breath braced, bar ready to move straight up.',
    movement:
      'Press the bar straight up — move your head back slightly so the bar clears your chin, then push your head through at the top.',
    endPosition:
      'Lockout with bar over mid-foot, biceps near ears, full extension without leaning back.',
    muscleFocus: 'Front and side delts press; triceps lock out. Squeeze glutes to avoid arching your lower back.',
  },
  'barbell-row': {
    equipment: 'Barbell on the floor or in low pins. Overhand grip slightly wider than shoulders.',
    setup:
      'Hinge until torso is roughly 45° to the floor (or parallel for Pendlay). Knees soft, back flat, core braced.',
    startPosition: 'Arms hanging straight down, bar under shoulders, lats engaged.',
    movement: 'Pull the bar to your lower ribs / upper abs by driving elbows toward the ceiling behind you.',
    endPosition: 'Squeeze shoulder blades together at the top; lower with control without losing your hinge angle.',
    muscleFocus: 'Mid-back and lats — think "pull with elbows, not hands." Chest stays toward the floor.',
  },
  'lat-pulldown': {
    equipment: 'Wide-grip bar or neutral attachment on the lat pulldown cable. Set thigh pad snug over your legs.',
    setup: 'Sit tall, thighs secured, feet flat. Lean back only slightly — not reclining.',
    startPosition: 'Arms extended overhead, shoulders depressed (away from ears), chest lifted.',
    movement: 'Pull the bar to your upper chest by driving elbows down and back — not behind your neck.',
    endPosition: 'Squeeze lats at the bottom; return slowly until arms extend without shrugging.',
    muscleFocus: 'Lats and mid-back. Initiate by pulling shoulder blades down before bending elbows.',
  },
  'pull-up': {
    equipment: 'Pull-up bar. Use a box to reach if needed. Weight belt only if prescribed.',
    setup: 'Hang with hands slightly wider than shoulders, palms away. Engage shoulders — do not hang loose in your joints.',
    startPosition: 'Full hang with active shoulders (slight pull-down before rep). Core braced, legs still or crossed.',
    movement: 'Pull chest toward the bar by driving elbows down toward your back pockets.',
    endPosition: 'Chin over bar or chest to bar; lower with control to full hang.',
    muscleFocus: 'Lats and mid-back initiate; biceps assist. No kipping unless programmed.',
    tips: ['Depress shoulders before each rep.', 'Think elbows to hips.'],
  },
  'push-up': {
    equipment: 'No equipment — bodyweight on floor. Hands on handles or plates optional for wrist comfort.',
    setup:
      'Hands slightly wider than shoulders, fingers forward. Body in one line: head, shoulders, hips, heels.',
    startPosition: 'Arms extended, core and glutes tight — no sagging hips.',
    movement: 'Lower chest toward floor with elbows ~45° from torso. Keep body rigid as a plank.',
    endPosition: 'Press back up to full extension without piking hips or flaring elbows wide.',
    muscleFocus: 'Chest and triceps press; core holds the line. Squeeze glutes throughout.',
  },
  'dumbbell-row': {
    equipment: 'One dumbbell and a flat bench. Pick a weight you can row without twisting.',
    setup:
      'One hand and knee on bench, other foot flat on floor wide enough for balance. Back flat, parallel to floor.',
    startPosition: 'Dumbbell hanging straight down from shoulder, neck neutral.',
    movement: 'Row dumbbell to your hip pocket — elbow drives past your torso.',
    endPosition: 'Squeeze back at top; lower fully without rotating hips or shoulders.',
    muscleFocus: 'Lats and mid-back on the working side. Plant the supporting hand and push the floor away with your foot.',
  },
  'goblet-squat': {
    equipment: 'One dumbbell or kettlebell held vertically at chest height ("goblet" position).',
    setup: 'Feet shoulder-width, toes out. Elbows point down inside your knees at the bottom.',
    startPosition: 'Weight at chest, shoulders down, core braced, heels down.',
    movement: 'Squat straight down between your hips — elbows can push knees out lightly.',
    endPosition: 'Drive through mid-foot to stand; keep chest tall throughout.',
    muscleFocus: 'Quads and glutes. Use the weight as a counterbalance — stay upright.',
  },
  'hip-thrust': {
    equipment: 'Barbell with pad over hips, upper back on bench. Plates should clear the bench at lockout.',
    setup:
      'Shoulder blades on bench, feet flat shoulder-width, knees bent ~90° at top. Bar over hip crease with padding.',
    startPosition: 'Hips low, chin tucked, ribs down.',
    movement: 'Drive hips up by squeezing glutes — shins vertical at the top.',
    endPosition: 'Torso parallel to floor, full hip extension without hyperextending lower back.',
    muscleFocus: 'Glutes maximally contracted at top — pause 1 second. Hamstrings assist; not your lower back.',
  },
  'bulgarian-split-squat': {
    equipment: 'Dumbbells at sides or barbell in rack position. Bench or box ~ knee height behind you.',
    setup:
      'Rear foot laces-down on bench. Front foot far enough forward that you can descend without knee crashing over toes.',
    startPosition: 'Torso tall, core braced, most weight on front leg.',
    movement: 'Lower straight down — back knee bends toward floor. Front shin stays mostly vertical.',
    endPosition: 'Drive through front heel to stand. Complete all reps on one leg before switching.',
    muscleFocus: 'Front leg quads and glutes. Keep hips square — do not rotate toward the back leg.',
  },
  'leg-press': {
    equipment: 'Leg press machine. Load pins on both sides evenly.',
    setup:
      'Sit with hips and low back flat against pad. Feet shoulder-width on platform — higher feet hit glutes/hams, lower hits quads.',
    startPosition: 'Knees bent, feet full contact, hands on handles, core braced.',
    movement: 'Unlock sled and lower until knees reach ~90° without your lower back peeling off the pad.',
    endPosition: 'Press through mid-foot to extend — do not lock knees violently.',
    muscleFocus: 'Quads on the press; glutes if feet are higher. Knees track over toes — no inward collapse.',
  },
  'face-pull': {
    equipment: 'Cable stack with rope attachment set at upper chest / face height.',
    setup: 'Staggered stance, core braced. Grab rope with thumbs toward you.',
    startPosition: 'Arms extended, shoulders down, chest up.',
    movement: 'Pull rope toward your face — elbows stay high and wide, above shoulder line.',
    endPosition: 'Externally rotate at end so knuckles point behind you; squeeze rear delts and mid-back.',
    muscleFocus: 'Rear delts and rotator cuff — not biceps. Think "pull apart the rope."',
  },
};
