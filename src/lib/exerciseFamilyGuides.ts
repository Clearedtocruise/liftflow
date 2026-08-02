/**
 * Written coaching for each movement family.
 *
 * Most of the catalog will never have a hand-reviewed, exercise-specific guide, and unreviewed
 * generated drafts proved unsafe — one told users to pick up a load and walk during an assault
 * bike sprint. A family template is the honest middle ground: it is accurate for every exercise
 * that genuinely belongs to the pattern, and it is labelled as pattern guidance rather than being
 * passed off as expertise about one specific lift.
 *
 * Each template carries the whole structure the guide sheet renders: ordered steps, a breathing
 * cue, the mistake that most often causes injury or wasted effort, and both a regression and a
 * progression.
 */

import type { ExerciseFormGuide } from '@/lib/exerciseFormGuides';
import type { MovementFamily } from '@/lib/exerciseMovementFamily';

/** Human wording for the "why am I seeing this" notice on the guide sheet. */
export const MOVEMENT_FAMILY_LABELS: Record<MovementFamily, string> = {
  horizontal_press: 'horizontal pressing',
  vertical_press: 'overhead pressing',
  chest_isolation: 'chest isolation',
  triceps_isolation: 'triceps isolation',
  vertical_pull: 'vertical pulling',
  horizontal_pull: 'rowing',
  biceps_isolation: 'biceps isolation',
  rear_delt: 'rear delt and upper back',
  lateral_raise: 'shoulder raises',
  squat_pattern: 'squatting',
  lunge_pattern: 'split-stance work',
  hinge_pattern: 'hip hinging',
  glute_isolation: 'glute isolation',
  quad_isolation: 'quad isolation',
  hamstring_isolation: 'hamstring isolation',
  calf_isolation: 'calf work',
  core_anti_extension: 'anti-extension core work',
  core_anti_lateral: 'anti-lateral core work',
  core_flexion: 'trunk flexion',
  core_rotation: 'rotational core work',
  carry: 'loaded carries',
  cardio: 'conditioning',
};

export const FAMILY_GUIDES: Record<MovementFamily, ExerciseFormGuide> = {
  horizontal_press: {
    steps: [
      'Set your shoulder blades down and back so the shoulders have a stable shelf to press from.',
      'Take a grip that lets your forearms stay vertical at the bottom of each rep.',
      'Lower under control until the working muscles are stretched, keeping elbows at roughly 45° from your torso.',
      'Press back to full extension along the same path without letting the shoulders roll forward.',
      'Inhale as you lower and exhale as you press through the hardest part of the rep.',
    ],
    tips: [
      'Avoid flaring the elbows straight out to the sides or bouncing the load off your chest.',
      'Easier: reduce the load or shorten the range until every rep looks the same.',
      'Harder: add load, or pause briefly at the bottom before pressing.',
    ],
  },
  vertical_press: {
    steps: [
      'Stand or sit tall with ribs down, glutes and core braced so the lower back does not arch.',
      'Start with the load at shoulder height and wrists stacked over your elbows.',
      'Press overhead, moving your head slightly back to let the load travel in a straight line.',
      'Finish with the load over the middle of your body, then lower under control to the shoulders.',
      'Exhale as you press overhead and inhale as the load returns to your shoulders.',
    ],
    tips: [
      'Avoid leaning back to force the load up — that turns a press into a standing incline press.',
      'Easier: press seated with back support, or use a lighter load through a full range.',
      'Harder: add load, or pause with the load overhead before lowering.',
    ],
  },
  chest_isolation: {
    steps: [
      'Set a stable base with shoulder blades pulled back and a small, fixed bend in your elbows.',
      'Open your arms until you feel a stretch across the chest, without pain at the front of the shoulder.',
      'Bring your hands together in a wide hugging arc, leading with the elbows.',
      'Squeeze the chest briefly at the end of the arc, then return slowly to the stretch.',
      'Inhale as you open your arms and exhale as you bring them together.',
    ],
    tips: [
      'Avoid turning the movement into a press by bending and straightening the elbows.',
      'Easier: reduce the load and the range until the stretch is comfortable.',
      'Harder: pause in the stretched position, or slow the return.',
    ],
  },
  triceps_isolation: {
    steps: [
      'Fix your upper arm in place so only the elbow joint moves through the set.',
      'Start with the elbow bent and the triceps under tension, not slack.',
      'Extend the elbow fully without letting the upper arm drift forward or backward.',
      'Squeeze at full extension, then return slowly to the starting bend.',
      'Exhale as you extend the elbow and inhale as you return.',
    ],
    tips: [
      'Avoid swinging the load or using the shoulder to help — this is a small, light movement.',
      'Easier: reduce the load until the upper arm stays completely still.',
      'Harder: add a brief squeeze at lockout, or slow the lowering phase.',
    ],
  },
  vertical_pull: {
    steps: [
      'Start from a full hang or full stretch with the shoulders relaxed upward.',
      'Set your shoulder blades down first — the pull starts before your elbows bend.',
      'Drive your elbows down toward your ribs, leading with the back rather than the hands.',
      'Finish with the chest tall, then return all the way to the stretched position under control.',
      'Exhale as you pull and inhale as you return to the stretch.',
    ],
    tips: [
      'Avoid shrugging at the top or dropping quickly out of the bottom of each rep.',
      'Easier: use assistance, a band, or a lighter stack through the full range.',
      'Harder: add load, or pause with the elbows fully driven down.',
    ],
  },
  horizontal_pull: {
    steps: [
      'Set your torso angle and keep it fixed — the back should not rise and fall with the load.',
      'Begin with the arms extended and the shoulder blades allowed to travel forward.',
      'Pull toward your lower ribs by driving the elbows back past your torso.',
      'Squeeze the shoulder blades together, then extend the arms fully under control.',
      'Exhale as you row and inhale as the load returns.',
    ],
    tips: [
      'Avoid jerking with the lower back or letting the torso swing to move the load.',
      'Easier: use a supported or chest-supported variation, or reduce the load.',
      'Harder: pause at the squeeze, or slow the return to the stretch.',
    ],
  },
  biceps_isolation: {
    steps: [
      'Stand or sit tall with the elbows tucked near your ribs and the shoulders down.',
      'Start with the arms fully extended so the biceps begin under tension.',
      'Curl the load up by bending only the elbow, keeping the upper arm still.',
      'Squeeze at the top, then lower slowly all the way to full extension.',
      'Exhale as you curl and inhale as you lower.',
    ],
    tips: [
      'Avoid swinging the load, leaning back, or letting the elbows drift forward.',
      'Easier: reduce the load, or curl seated so the torso cannot help.',
      'Harder: slow the lowering phase, or pause at the mid-range.',
    ],
  },
  rear_delt: {
    steps: [
      'Set the shoulders down and back with a small, fixed bend in the elbows.',
      'Start with the arms in front of you and the upper back allowed to stretch.',
      'Pull the arms back and slightly wide, leading with the elbows.',
      'Finish with the shoulder blades gently together, then return slowly under control.',
      'Exhale as you pull back and inhale as you return.',
    ],
    tips: [
      'Avoid shrugging the shoulders up or using the lower back to swing the weight.',
      'Easier: use a very light load — this area responds to control, not weight.',
      'Harder: pause at the end of the pull rather than adding load.',
    ],
  },
  lateral_raise: {
    steps: [
      'Stand tall with a light load, elbows very slightly bent and shoulders down.',
      'Start with the arms at your sides and the shoulder muscles already under tension.',
      'Raise the arms out to about shoulder height, leading with the elbows.',
      'Pause briefly at the top, then lower slowly rather than letting the arms drop.',
      'Exhale as you raise the arms and inhale as you lower them.',
    ],
    tips: [
      'Avoid shrugging, swinging, or raising far above shoulder height with a heavy load.',
      'Easier: reduce the load sharply — this movement needs less weight than people expect.',
      'Harder: slow the lowering phase, or pause at shoulder height.',
    ],
  },
  squat_pattern: {
    steps: [
      'Set your feet about shoulder-width with toes turned slightly out.',
      'Brace your core as if you were about to be pushed, and keep your chest tall.',
      'Sit down and back, letting the knees travel forward over the toes as the hips drop.',
      'Descend as deep as you can while keeping a neutral spine, then drive up through the whole foot.',
      'Inhale and brace before descending; exhale after you pass the hardest part of the drive up.',
    ],
    tips: [
      'Avoid letting the heels lift, the knees collapse inward, or the chest fall toward the floor.',
      'Easier: reduce depth or load, or hold the weight in front of you for balance.',
      'Harder: add depth first, then load, then a pause at the bottom.',
    ],
  },
  lunge_pattern: {
    steps: [
      'Set your stance long enough that both knees can bend to about 90° without crowding.',
      'Stand tall with your weight mostly through the front foot and the core braced.',
      'Lower straight down until the back knee approaches the floor.',
      'Drive through the front foot to return, keeping the hips square throughout.',
      'Inhale as you lower and exhale as you drive back up.',
    ],
    tips: [
      'Avoid letting the front knee collapse inward or the torso twist toward the working leg.',
      'Easier: hold a support for balance, reduce depth, or use bodyweight only.',
      'Harder: add load, slow the descent, or elevate the rear foot.',
    ],
  },
  hinge_pattern: {
    steps: [
      'Stand with a soft bend in the knees and the load close to your body.',
      'Brace your core and set your back flat before anything moves.',
      'Push your hips backward, letting your torso come forward as the hamstrings load.',
      'Stop when your back would otherwise round, then drive the hips forward to stand tall.',
      'Inhale and brace at the top; exhale as the hips drive forward to standing.',
    ],
    tips: [
      'Avoid rounding the lower back, squatting the movement, or letting the load drift away from you.',
      'Easier: shorten the range and reduce the load until the hips move without the spine moving.',
      'Harder: add load or range only while the back stays flat and the load stays close.',
    ],
  },
  glute_isolation: {
    steps: [
      'Set your ribs down and your pelvis level so the movement comes from the hip, not the lower back.',
      'Begin with the glutes under tension rather than fully relaxed.',
      'Drive the hip into extension, squeezing the glute of the working side.',
      'Pause briefly at full extension, then return under control without losing pelvic position.',
      'Exhale as you drive the hip into extension and inhale as you return.',
    ],
    tips: [
      'Avoid arching the lower back to fake extra range — the glute should do the work.',
      'Easier: reduce the load or range and focus on feeling the glute contract.',
      'Harder: add a pause at the top, then load, keeping the pelvis level.',
    ],
  },
  quad_isolation: {
    steps: [
      'Set the machine so the knee joint lines up with the pivot point.',
      'Sit back against the pad with the hips secure.',
      'Extend the knees smoothly until the legs are straight but not forcefully locked.',
      'Pause briefly, then lower under control without letting the weight stack slam.',
      'Exhale as you extend the knees and inhale as you lower.',
    ],
    tips: [
      'Avoid jerking into lockout or letting the hips lift off the pad.',
      'Easier: reduce the load and use a smaller range if the knees feel irritated.',
      'Harder: pause at full extension, or slow the lowering phase.',
    ],
  },
  hamstring_isolation: {
    steps: [
      'Set up so the knee or hip joint aligns with the machine pivot, or so the hamstrings take the load directly.',
      'Begin with the hamstrings lengthened and under tension.',
      'Shorten the hamstrings smoothly, without the hips rising to help.',
      'Pause briefly at peak contraction, then return slowly to the stretched position.',
      'Exhale during the working phase and inhale as you return to the stretch.',
    ],
    tips: [
      'Avoid rushing the lowering phase — most hamstring strains happen under fast eccentric load.',
      'Easier: reduce the load or range, and control the return with assistance if needed.',
      'Harder: slow the eccentric before adding any weight.',
    ],
  },
  calf_isolation: {
    steps: [
      'Place the balls of your feet on the platform with the heels free to travel below.',
      'Stand tall with the knees in a fixed position for the whole set.',
      'Rise onto the toes as high as you can and pause at the top.',
      'Lower the heels slowly until you feel a full stretch through the calf.',
      'Exhale as you rise and inhale as you lower into the stretch.',
    ],
    tips: [
      'Avoid bouncing out of the bottom, which uses the tendon instead of the muscle.',
      'Easier: hold a support for balance and reduce the load.',
      'Harder: pause at the top and bottom rather than adding weight quickly.',
    ],
  },
  core_anti_extension: {
    steps: [
      'Set your body in a straight line from head to heels with the elbows or hands under the shoulders.',
      'Brace your core and squeeze the glutes so the lower back cannot sag.',
      'Keep the ribs pulled down toward the hips rather than flaring open.',
      'Hold or move slowly for the prescribed time, stopping the moment the position breaks.',
      'Breathe steadily behind the brace — do not hold your breath for the whole set.',
    ],
    tips: [
      'Avoid letting the hips sag toward the floor or pike up toward the ceiling.',
      'Easier: shorten the lever by dropping to the knees, or reduce the hold time.',
      'Harder: add time or lengthen the lever before adding any external load.',
    ],
  },
  core_anti_lateral: {
    steps: [
      'Set up on your side or with the load on one side only, with the shoulders and hips stacked.',
      'Brace your core and lift or hold so the body forms a straight line.',
      'Resist the pull toward the loaded side — the goal is to not bend, not to bend and return.',
      'Hold or move slowly for the prescribed time, then repeat on the other side.',
      'Breathe steadily behind the brace without letting the ribs flare.',
    ],
    tips: [
      'Avoid letting the hips drop, rotate, or drift behind the shoulders.',
      'Easier: bend the knees, shorten the hold, or reduce the load.',
      'Harder: add time or load while keeping the shoulders and hips perfectly stacked.',
    ],
  },
  core_flexion: {
    steps: [
      'Start with the lower back in a comfortable, neutral-to-lightly-flexed position.',
      'Brace before moving so the movement is controlled by the abdominals, not momentum.',
      'Curl the ribs toward the pelvis through a range you can control.',
      'Pause at the shortened position, then lower slowly rather than dropping back.',
      'Exhale as you curl up and inhale as you lower.',
    ],
    tips: [
      'Avoid yanking on your neck or using momentum to swing through the reps.',
      'Easier: reduce the range or the load, and slow every rep down.',
      'Harder: add a pause at the top, or hold a light weight against the chest.',
    ],
  },
  core_rotation: {
    steps: [
      'Set a stable base with the hips and feet controlling your position.',
      'Brace your core and start with the ribs stacked over the pelvis.',
      'Rotate from the mid-back and ribcage while the hips stay relatively quiet.',
      'Return under control to the start rather than letting the load pull you back.',
      'Exhale as you rotate away and inhale as you return.',
    ],
    tips: [
      'Avoid forcing rotation from the lower back or throwing the load with straight arms.',
      'Easier: reduce the load and the range, and move slowly.',
      'Harder: increase the range or the load only while the hips stay controlled.',
    ],
  },
  carry: {
    steps: [
      'Pick the load up with a braced core and a flat back, standing fully tall before you walk.',
      'Set the shoulders down and back with the ribs stacked over the pelvis.',
      'Take short, controlled steps without leaning away from the load.',
      'Walk the prescribed distance or time, then set the load down with the same flat back.',
      'Breathe in short, controlled cycles behind the brace rather than holding your breath.',
    ],
    tips: [
      'Avoid leaning, twisting, or rushing the steps as the grip starts to fatigue.',
      'Easier: reduce the load or distance, and carry with both hands.',
      'Harder: add distance or load while keeping the same posture and step speed.',
    ],
  },
  cardio: {
    steps: [
      'Start easy for the first minute and let the effort build rather than sprinting from a standstill.',
      'Stand or sit tall with relaxed shoulders and a quiet, controlled upper body.',
      'Settle into a rhythm you can repeat, matching effort to the session target.',
      'Ease off gradually at the end instead of stopping abruptly.',
      'Breathe steadily in a rhythm you could hold a short conversation through at easy effort.',
    ],
    tips: [
      'Avoid going out at maximum effort or letting posture collapse as fatigue rises.',
      'Easier: reduce pace, resistance, incline, or the length of each work interval.',
      'Harder: increase one variable at a time — pace, resistance, incline, or duration.',
    ],
  },
};

export function familyGuide(family: MovementFamily): ExerciseFormGuide {
  return FAMILY_GUIDES[family];
}
