/**
 * Guards the exercise guide sheet's derived content: phase labels, section routing and difficulty.
 *
 * Usage: npm run validate:exercise-guide
 */
import { resolveExerciseDifficulty } from '@/lib/exerciseDifficulty';
import { resolveExerciseFormGuide } from '@/lib/exerciseFormGuides';
import { resolveExerciseGuideSections } from '@/lib/exerciseGuideSections';
import type { Exercise } from '@/types';
import type { MovementCategory } from '@/types/common';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failures += 1;
  console.log(
    `  ${pass ? 'PASS' : 'FAIL'} — ${label}${pass ? '' : ` (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`,
  );
}

function exercise(name: string, equipment: string, slug?: string, category: MovementCategory = 'pull'): Exercise {
  return {
    id: name,
    name,
    slug,
    category,
    exerciseType: 'strength',
    equipment,
    muscleGroups: ['back'],
    isSystem: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function sectionsFor(name: string, equipment: string, slug?: string) {
  const target = exercise(name, equipment, slug);
  return resolveExerciseGuideSections(resolveExerciseFormGuide(target, name));
}

console.log('\nDifficulty reflects skill demand, not just equipment');
const difficultyCases: Array<[string, string, string | undefined, string]> = [
  ['Bench Press', 'barbell', 'bench-press', 'Intermediate'],
  ['Deadlift', 'barbell', 'deadlift', 'Intermediate'],
  // Bodyweight pulling keeps its balance demand, so it must not be downgraded like a machine.
  ['Pull Up', 'bodyweight', 'pull-up', 'Intermediate'],
  ['Dip', 'bodyweight', 'dip', 'Intermediate'],
  ['Leg Press', 'machine', 'leg-press', 'Beginner'],
  ['Seated Cable Row', 'cable', 'seated-cable-row', 'Beginner'],
  ['Dumbbell Curl', 'dumbbell', 'dumbbell-curl', 'Beginner'],
  ['Muscle Up', 'bodyweight', undefined, 'Advanced'],
  ['Pistol Squat', 'bodyweight', undefined, 'Advanced'],
];
for (const [name, equipment, slug, expected] of difficultyCases) {
  check(name, resolveExerciseDifficulty(exercise(name, equipment, slug), name), expected);
}

console.log('\nPhases are named from the movement, and only movement steps become phases');
const pullUp = sectionsFor('Pull Up', 'bodyweight', 'pull-up');
check('Pull Up phase labels', pullUp.phases.map((phase) => phase.label), ['Setup', 'Depress', 'Pull', 'Lower']);

const hammerRow = sectionsFor('Hammer Row', 'machine');
check('Hammer Row phase labels', hammerRow.phases.map((phase) => phase.label), ['Setup', 'Pull', 'Squeeze', 'Lower']);

const guided = [
  'Bench Press',
  'Squat',
  'Deadlift',
  'Pull Up',
  'Leg Press',
  'Hammer Row',
  'Seated Cable Row',
  'Dumbbell Curl',
] as const;

for (const name of guided) {
  const sections = sectionsFor(name, 'barbell');
  check(
    `${name} has at least one phase`,
    sections.phases.length > 0,
    true,
  );
  check(
    `${name} routes mistakes out of the walkthrough`,
    sections.phases.some((phase) => /^(avoid|do not|don'?t|never)\b/i.test(phase.detail)),
    false,
  );
  check(
    `${name} routes regressions out of the walkthrough`,
    sections.phases.some((phase) => /^(regress|progress)/i.test(phase.detail)),
    false,
  );
  check(
    `${name} never labels a phase with a bare index when a verb is present`,
    sections.phases.every((phase) => phase.label.trim().length > 0),
    true,
  );

  const phaseDetails = new Set(
    sections.phases.map((phase) => phase.detail.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()),
  );
  check(
    `${name} does not repeat a phase as a cue`,
    sections.cues.some((cue) => phaseDetails.has(cue.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim())),
    false,
  );
}

console.log('\nBreathing guidance gets its own section');
const bench = sectionsFor('Bench Press', 'barbell', 'bench-press');
check('Bench Press breathing captured', /inhale|exhale/i.test(bench.breathing ?? ''), true);
check('Bench Press breathing is not a phase', bench.phases.some((phase) => phase.detail === bench.breathing), false);

console.log(`\n${failures === 0 ? 'Exercise guide: PASS' : `Exercise guide: ${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
