/**
 * Guards the home screen's arithmetic, and the rule that it never shows a number it does not have.
 *
 * The redesign is dense with metrics, which makes a placeholder easy to add and hard to notice. Every
 * check below exists because the honest version and the impressive-looking version differ.
 *
 * Usage: npm run validate:home-dashboard
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describeCalorieBudget, describeProteinBudget } from '@/lib/calorieBudget';
import { describeStrengthGain, findStrengthGain, weeklyBest, type CoachSetSample } from '@/lib/coachInsight';
import { greetingForHour, greetingName } from '@/lib/homeGreeting';
import { resolveDisplayName } from '@/lib/resolveDisplayName';
import { resolveExerciseMuscles } from '@/lib/exerciseMuscleMap';
import { withTodayFallback } from '@/lib/homeMetricFallback';
import { upNextGlyph } from '@/lib/upNextGlyph';

const EMPTY_METRIC = { value: undefined, history: [] as (number | undefined)[] };

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failures += 1;
  console.log(
    `  ${pass ? 'PASS' : 'FAIL'} — ${label}${pass ? '' : ` (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`,
  );
}

const repoRoot = join(__dirname, '..');
const source = (path: string) => readFileSync(join(repoRoot, path), 'utf8');

const NOW = new Date('2026-07-26T12:00:00.000Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86400000).toISOString();

function set(name: string, weightKg: number, days: number, reps = 8): CoachSetSample {
  return { exerciseName: name, weightKg, reps, loggedAt: daysAgo(days) };
}

console.log('\nA strength gain needs evidence on both sides of the comparison');
check(
  'a heavier recent lift beats the prior window',
  findStrengthGain([set('Bench Press', 75, 40), set('Bench Press', 84, 5)], NOW)?.deltaKg,
  9,
);
// Without this, a first-ever session would be reported as an infinite gain.
check(
  'a lift with no prior-window history is not a gain',
  findStrengthGain([set('Bench Press', 84, 5)], NOW),
  null,
);
check(
  'a lighter recent lift is not a gain',
  findStrengthGain([set('Bench Press', 90, 40), set('Bench Press', 80, 5)], NOW),
  null,
);
check(
  'the largest gain wins across exercises',
  findStrengthGain(
    [
      set('Bench Press', 75, 40),
      set('Bench Press', 80, 5),
      set('Back Squat', 100, 40),
      set('Back Squat', 120, 5),
    ],
    NOW,
  )?.exerciseName,
  'Back Squat',
);
check(
  'names differing only by case are the same exercise',
  findStrengthGain([set('bench press', 75, 40), set('Bench Press', 84, 5)], NOW)?.deltaKg,
  9,
);

console.log('\nSets that are not evidence of a heavier lift are ignored');
check(
  'bodyweight sets carry no weight and are skipped',
  findStrengthGain([{ exerciseName: 'Pull Up', reps: 10, loggedAt: daysAgo(40) }, { exerciseName: 'Pull Up', reps: 12, loggedAt: daysAgo(5) }], NOW),
  null,
);
check(
  'a set with zero reps is not a lift',
  findStrengthGain([set('Bench Press', 75, 40), set('Bench Press', 120, 5, 0)], NOW),
  null,
);
check(
  'anything older than both windows is out of scope',
  findStrengthGain([set('Bench Press', 40, 400), set('Bench Press', 84, 5)], NOW),
  null,
);

console.log('\nWeekly history keeps gaps as gaps');
// 3 days ago lands in the newest bucket; 24 days ago is three weeks back, so bucket 1.
const history = weeklyBest([set('Bench Press', 80, 3), set('Bench Press', 70, 24)], 'bench press', NOW, 5);
check('one entry per week', history.length, 5);
check('the newest week holds the newest lift', history[4], 80);
check('the lift three weeks back lands in its own week', history[1], 70);
check('a week without the lift stays undefined, not zero', history[2], undefined);
check('only the weeks that have a lift are filled', history.filter((week) => week != null).length, 2);

console.log('\nThe wording is earned rather than automatic');
const bigGain = findStrengthGain([set('Bench Press', 75, 40), set('Bench Press', 84, 5)], NOW)!;
check(
  'a 12% gain gets the flourish',
  describeStrengthGain(bigGain, 20, 'lb').includes("That's huge"),
  true,
);
const smallGain = findStrengthGain([set('Bench Press', 100, 40), set('Bench Press', 101, 5)], NOW)!;
check(
  'a 1% gain does not',
  describeStrengthGain(smallGain, 2, 'lb').includes("That's huge"),
  false,
);
check(
  'the exercise is named in the message',
  describeStrengthGain(bigGain, 20, 'lb').includes('Bench Press'),
  true,
);

console.log('\nThe screen shows nothing rather than a placeholder');
const hero = source('src/components/dashboard/TodayHeroCard.tsx');
const tile = source('src/components/dashboard/StatTile.tsx');
const metrics = source('src/hooks/useHomeMetrics.ts');
const screen = source('src/app/(tabs)/dashboard.tsx');
const spark = source('src/components/ui/Sparkline.tsx');

check(
  'the recovery ring only renders once a score exists',
  hero.includes('if (percent == null)'),
  true,
);
check(
  'a metric with no reading renders an em dash, not a zero',
  tile.includes("{hasValue ? value : '—'}"),
  true,
);
check(
  'a failed health query is not reported as an empty one',
  metrics.includes('setHealthEmpty(false)'),
  true,
);
check(
  'the coach card is omitted when no gain can be evidenced',
  screen.includes('{metrics.coachInsight ? ('),
  true,
);
check(
  'a single data point is not drawn as a trend',
  spark.includes('if (present.length < 2)'),
  true,
);
check(
  'missing days break the sparkline rather than being interpolated',
  spark.includes('Missing days break the line'),
  true,
);

console.log('\nUp Next is not confined to the current week');
const training = source('src/services/trainingService.ts');
const dashboardHook = source('src/hooks/useTodayDashboard.ts');
// dedupePlannedWorkoutsByDate drops every date outside the current week, so going through
// getPlannedWorkouts would hide tomorrow's session every Sunday.
check(
  'a dedicated query fetches the next session',
  training.includes('async getNextPlannedWorkout('),
  true,
);
check(
  'the hook uses it rather than filtering the week',
  dashboardHook.includes('trainingService.getNextPlannedWorkout(user.id, today)'),
  true,
);

console.log('\nThe calorie tile never invents a number it does not have');
// "0 of 2,400" for somebody who has not logged breakfast yet reads as a failure to eat rather than
// a failure to log, which is the same class of lie the health tiles avoid.
check('nothing logged shows no value', describeCalorieBudget(undefined, 2400).value, undefined);
check('nothing logged prompts with the goal', describeCalorieBudget(undefined, 2400).emptyHint, 'Goal 2,400 cal');
check('zero logged is treated as nothing logged', describeCalorieBudget(0, 2400).value, undefined);
check('no goal and no intake asks for a meal', describeCalorieBudget(undefined, undefined).emptyHint, 'Log a meal');
check('no progress bar without a target', describeCalorieBudget(1800, undefined).percent, undefined);
check('intake still shows without a target', describeCalorieBudget(1800, undefined).value, '1,800');

console.log('\nProgress against a target is reported accurately');
check('value is the amount eaten', describeCalorieBudget(1840, 2400).value, '1,840');
check('caption names the target and the remainder', describeCalorieBudget(1840, 2400).caption, 'of 2,400 · 560 left');
check('percent is intake over target', describeCalorieBudget(1200, 2400).percent, 50);
check('hitting the target exactly is 100%', describeCalorieBudget(2400, 2400).percent, 100);
check('reaching the target leaves nothing', describeCalorieBudget(2400, 2400).caption, 'of 2,400 · 0 left');

console.log('\nGoing over the target is reported as over, not as leftover');
check('overage is labelled over', describeCalorieBudget(2600, 2400).caption, 'of 2,400 · 200 over');
check('percent exceeds 100 when over', describeCalorieBudget(2600, 2400).percent, 108);
// The bar clamps in the component; the number underneath still tells the truth.
check('a large overage still reports honestly', describeCalorieBudget(4800, 2400).percent, 200);

console.log('\nThe protein tile carries its unit and follows the same rules');
check('grams are suffixed on the value', describeProteinBudget(120, 180).value, '120g');
check('grams are suffixed throughout the caption', describeProteinBudget(120, 180).caption, 'of 180g · 60g left');
check('percent is intake over target', describeProteinBudget(90, 180).percent, 50);
check('nothing logged shows the goal in grams', describeProteinBudget(undefined, 180).emptyHint, 'Goal 180g');
check('nothing logged shows no value', describeProteinBudget(undefined, 180).value, undefined);
check('no goal set asks for a meal', describeProteinBudget(undefined, undefined).emptyHint, 'Log a meal');
check('over target is labelled over', describeProteinBudget(200, 180).caption, 'of 180g · 20g over');
check('intake without a target still shows', describeProteinBudget(120, undefined).value, '120g');

console.log('\nProtein on home does not remove calories from the nutrition screen');
// The home tile changed to protein by request; the nutrition screen is where calories still live,
// so a future tidy-up of that header must not quietly take them away.
const nutritionHeader = source('src/components/nutrition/NutritionProgressHeader.tsx');
check('the nutrition header still reports calories', nutritionHeader.includes('cal'), true);
check('the nutrition header still reports protein', nutritionHeader.includes('protein'), true);
check(
  'the protein target reaches the daily summary',
  source('src/services/nutritionService.ts').includes('proteinTargetG: goalsResult.data?.protein_g'),
  true,
);

console.log('\nA hand-entered figure still reaches the tile when the wearable has nothing');
// Sleep typed into the recovery check-in drives the recovery score but was invisible on home,
// because the tile read Apple Health alone.
check(
  'the check-in value fills an empty metric',
  withTodayFallback({ value: undefined, history: [undefined, undefined] }, 7.5).value,
  7.5,
);
check(
  'it lands on today rather than an earlier day',
  withTodayFallback({ value: undefined, history: [undefined, undefined] }, 7.5).history,
  [undefined, 7.5],
);
check(
  'measured data for today is never overwritten by an estimate',
  withTodayFallback({ value: 6.2, history: [6.0, 6.2] }, 9).value,
  6.2,
);
check(
  'yesterday\'s Health reading does not hide today\'s check-in',
  withTodayFallback({ value: 6.2, history: [6.2, undefined] }, 8).value,
  8,
);
check(
  'yesterday stays in history when today is filled from check-in',
  withTodayFallback({ value: 6.2, history: [6.2, undefined] }, 8).history,
  [6.2, 8],
);
check('no fallback value leaves the metric alone', withTodayFallback(EMPTY_METRIC, undefined).value, undefined);
check('a non-finite fallback is ignored', withTodayFallback(EMPTY_METRIC, Number.NaN).value, undefined);
check('an empty history stays empty rather than gaining a phantom day', withTodayFallback(EMPTY_METRIC, 7).history, []);

console.log('\nHome reads nutrition for the same day the user logged it against');
// getDailySummary defaults to the device clock; the meal was written against the profile time zone,
// so without passing the date an evening meal can count toward a day home is not showing.
check(
  'the hook passes an explicit timezone-aware date',
  source('src/hooks/useHomeMetrics.ts').includes('nutritionService.getDailySummary(user.id, dates[dates.length - 1])'),
  true,
);
check(
  'sleep falls back to the recovery check-in',
  source('src/hooks/useHomeMetrics.ts').includes('withTodayFallback('),
  true,
);

console.log('\nA completed workout congratulates — it does not become a recovery day');
// Finishing a session flips planned status to completed. Only startable (`planned`) workouts used
// to reach the hero, so home collapsed into Recovery Day the moment the session ended.
const heroCard = source('src/components/dashboard/TodayHeroCard.tsx');
const todayHook = source('src/hooks/useTodayDashboard.ts');
const dash = source('src/app/(tabs)/dashboard.tsx');
check('hero has a completed state', heroCard.includes("kind: 'completed'"), true);
check('completed hero says congratulations', heroCard.includes('Congratulations'), true);
check('completed hero launches fireworks', heroCard.includes('CelebrationBurst'), true);
check('Recovery Day is reserved for genuine rest', heroCard.includes('Recovery Day'), true);
check('the hook tracks completed today separately', todayHook.includes('completedTodaysWorkout'), true);
check('the screen prefers completed over rest', dash.includes('completedTodaysWorkout'), true);
check('fireworks component exists', source('src/components/dashboard/CelebrationBurst.tsx').includes('CelebrationBurst'), true);

console.log('\nHome header: greeting name, streak placement, real logo');
const homeHeader = source('src/components/dashboard/HomeHeader.tsx');
check('greeting uses the profile display name', homeHeader.includes('greetingName(displayName)'), true);
check('first name is taken from the full display name', greetingName('Timothy Barrett'), 'Timothy');
check('a single-token name stays intact', greetingName('Timothy'), 'Timothy');
check('blank names are omitted rather than inventing one', greetingName('   '), undefined);
check('morning greeting', greetingForHour(8), 'Good Morning');
check('evening greeting', greetingForHour(20), 'Good Evening');
check(
  'auth metadata name reaches the greeting when profile is empty',
  resolveDisplayName({ profileName: null, metadata: { display_name: 'Timothy Barrett' } }),
  'Timothy Barrett',
);
check(
  'email local-part is never invented as a greeting name',
  resolveDisplayName({ profileName: null, metadata: null }),
  undefined,
);
check(
  'profile name wins over metadata',
  resolveDisplayName({ profileName: 'Timothy', metadata: { display_name: 'Other' } }),
  'Timothy',
);
check('streak sits under the greeting on the left', homeHeader.includes("alignSelf: 'flex-start'"), true);
check('header uses the real ONE MORE logo mark', homeHeader.includes('LiftFlowLogo'), true);
check('header shows the ONE MORE company name', homeHeader.includes('ONE MORE'), true);
check('header shows the FITNESS wordmark', homeHeader.includes('FITNESS'), true);
check('text wordmark is no longer the top-right brand', homeHeader.includes('BrandWordmark'), false);
check(
  'auth backfills an empty profile display name',
  source('src/services/authService.ts').includes("update({ display_name: resolved })"),
  true,
);
check(
  'signup trigger migration copies auth metadata name',
  source('supabase/migrations/033_profile_display_name_from_auth.sql').includes('raw_user_meta_data'),
  true,
);

console.log('\nThe Up Next tile uses an icon, not a squeezed anatomy figure');
// The anatomy SVG is 200×400 and nothing legible survives a thumbnail, so the tile carries a glyph.
// The card already names the session, which is what the figure was redundantly trying to say.
const upNext = source('src/components/dashboard/UpNextCard.tsx');
check('no body figure is rendered in the tile', upNext.includes('MuscleMapFigure'), false);
check('the tile renders a symbol', upNext.includes('AppSymbol'), true);

console.log('\nEvery training focus resolves to a legible glyph');
for (const muscle of ['chest', 'lats', 'quads', 'abs', 'biceps'] as const) {
  const glyph = upNextGlyph(muscle);
  check(`${muscle} has a symbol`, glyph.symbol.length > 0, true);
  check(`${muscle} has an Android fallback`, glyph.fallback.length > 0, true);
}
check('an unknown focus still returns a glyph', upNextGlyph(undefined).symbol.length > 0, true);
// Push and legs must not look identical, or the tile stops carrying information at a glance.
check(
  'push and legs are visually distinct',
  upNextGlyph('chest').gradient[0] !== upNextGlyph('quads').gradient[0],
  true,
);

console.log('\nUp Next reads multi-focus day titles, not a stray core keyword');
{
  const day = resolveExerciseMuscles('Back, Biceps & Core — Week 2', ['core', 'back', 'biceps']);
  check('Back/Biceps/Core day leads with back', day.primary[0], 'mid-back');
  check(
    'Back/Biceps/Core day uses the pull glyph, not core',
    upNextGlyph(day.primary[0]).symbol,
    upNextGlyph('lats').symbol,
  );
  const coreOnlyGroups = resolveExerciseMuscles('Back, Biceps & Core', ['abs']);
  check('day title beats a lone abs group', coreOnlyGroups.primary[0], 'mid-back');
  const accessoryFirst = resolveExerciseMuscles('Pull Day', ['core', 'lats', 'biceps']);
  check('accessory groups do not steal the lead focus', accessoryFirst.primary[0], 'lats');
}

console.log(`\nHome dashboard: ${failures === 0 ? 'PASS' : `FAIL (${failures})`}`);
process.exit(failures === 0 ? 0 : 1);
