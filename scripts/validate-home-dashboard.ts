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

import { describeCalorieBudget } from '@/lib/calorieBudget';
import { describeStrengthGain, findStrengthGain, weeklyBest, type CoachSetSample } from '@/lib/coachInsight';

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

console.log(`\nHome dashboard: ${failures === 0 ? 'PASS' : `FAIL (${failures})`}`);
process.exit(failures === 0 ? 0 : 1);
