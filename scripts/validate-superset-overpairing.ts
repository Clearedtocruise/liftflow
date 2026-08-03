/**
 * Guards against the "everything is a supersets" production bug.
 *
 * Usage: npx tsx scripts/validate-superset-overpairing.ts
 */
import {
  applyBlockSupersets,
  enrichWithSmartSupersetGroups,
} from '../backend/src/lib/liftingReference/applyReferenceSupersets';
import {
  enrichWithSupersetGroups,
  inferExecutionModeFromPlan,
  sanitizeOverpairedSupersets,
} from '@/lib/supersetFlow';
import type { EditableWorkoutExercise } from '@/types/workoutExecution';

type NamedCandidate = {
  name: string;
  block?: string;
  supersetGroupId?: string;
  metadata?: { movement_family?: string };
};

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failures += 1;
  console.log(
    `  ${pass ? 'PASS' : 'FAIL'} — ${label}${pass ? '' : ` (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`,
  );
}

console.log('\nSmart pairing must not invent groups without movement families');
check(
  'empty metadata stays unpaired',
  enrichWithSmartSupersetGroups<NamedCandidate>([
    { name: 'Bench' },
    { name: 'Row' },
    { name: 'Curl' },
    { name: 'Extension' },
  ]).map((exercise) => exercise.supersetGroupId ?? null),
  [null, null, null, null],
);

console.log('\nBlock supersets only pair numbered stations');
check(
  'bare A compounds stay solo',
  applyBlockSupersets<NamedCandidate>([
    { block: 'A', name: 'Bench' },
    { block: 'A', name: 'Also' },
    { block: 'B1', name: 'Fly' },
    { block: 'B2', name: 'Raise' },
  ]).map((exercise) => exercise.supersetGroupId ?? null),
  [null, null, 'ss-b', 'ss-b'],
);

console.log('\nSaved over-paired plans are scrubbed on load');
const overpaired: EditableWorkoutExercise[] = [
  { id: '1', name: 'A', sets: 3, supersetGroupId: 'ss-1' },
  { id: '2', name: 'B', sets: 3, supersetGroupId: 'ss-1' },
  { id: '3', name: 'C', sets: 3, supersetGroupId: 'ss-2' },
  { id: '4', name: 'D', sets: 3, supersetGroupId: 'ss-2' },
  { id: '5', name: 'E', sets: 3, supersetGroupId: 'ss-3' },
  { id: '6', name: 'F', sets: 3, supersetGroupId: 'ss-3' },
  { id: '7', name: 'G', sets: 3, supersetGroupId: 'ss-4' },
  { id: '8', name: 'H', sets: 3, supersetGroupId: 'ss-4' },
];
check(
  'sanitize strips wall-to-wall adjacent pairs',
  sanitizeOverpairedSupersets(overpaired).every((exercise) => !exercise.supersetGroupId),
  true,
);
check(
  'enrichWithSupersetGroups scrub path',
  enrichWithSupersetGroups(overpaired, 'traditional').every((exercise) => !exercise.supersetGroupId),
  true,
);
check(
  'inferExecutionMode stays traditional after scrub',
  inferExecutionModeFromPlan(overpaired, 'traditional'),
  'traditional',
);

console.log('\nLegitimate sparse Month 1-style pairs survive');
const month1Style: EditableWorkoutExercise[] = [
  { id: '1', name: 'Bench', sets: 4 },
  { id: '2', name: 'Incline', sets: 3, supersetGroupId: 'ss-b' },
  { id: '3', name: 'Raise', sets: 3, supersetGroupId: 'ss-b' },
  { id: '4', name: 'Fly', sets: 3, supersetGroupId: 'ss-c' },
  { id: '5', name: 'Pushdown', sets: 3, supersetGroupId: 'ss-c' },
  { id: '6', name: 'OHP', sets: 4 },
  { id: '7', name: 'Curl', sets: 3 },
  { id: '8', name: 'Kickback', sets: 3 },
];
check(
  'sparse pairs kept',
  sanitizeOverpairedSupersets(month1Style).map((exercise) => exercise.supersetGroupId ?? null),
  [null, 'ss-b', 'ss-b', 'ss-c', 'ss-c', null, null, null],
);
check(
  'inferExecutionMode becomes superset for real pairs',
  inferExecutionModeFromPlan(month1Style, 'traditional'),
  'superset',
);

console.log(`\n${failures === 0 ? 'Superset over-pairing: PASS' : `Superset over-pairing: ${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
