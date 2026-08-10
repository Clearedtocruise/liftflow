/**
 * Guards that supersets stay disabled (no pairing at plan or session load).
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
  stripAllSupersetGroups,
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

console.log('\nPlan-time pairing is off');
check(
  'smart pairing strips and invents nothing',
  enrichWithSmartSupersetGroups<NamedCandidate>([
    { name: 'Curl', metadata: { movement_family: 'biceps' }, supersetGroupId: 'ss-1' },
    { name: 'Extension', metadata: { movement_family: 'triceps' }, supersetGroupId: 'ss-1' },
  ]).map((exercise) => exercise.supersetGroupId ?? null),
  [null, null],
);

check(
  'block pairing strips numbered stations',
  applyBlockSupersets<NamedCandidate>([
    { block: 'B1', name: 'Fly', supersetGroupId: 'ss-b' },
    { block: 'B2', name: 'Raise', supersetGroupId: 'ss-b' },
  ]).map((exercise) => exercise.supersetGroupId ?? null),
  [null, null],
);

console.log('\nSession load strips every leftover group');
const withGroups: EditableWorkoutExercise[] = [
  { id: '1', name: 'A', sets: 3, supersetGroupId: 'ss-1' },
  { id: '2', name: 'B', sets: 3, supersetGroupId: 'ss-1' },
  { id: '3', name: 'C', sets: 3, supersetGroupId: 'ss-2' },
  { id: '4', name: 'D', sets: 3, supersetGroupId: 'ss-2' },
];
check(
  'stripAllSupersetGroups clears ids',
  stripAllSupersetGroups(withGroups).every((exercise) => !exercise.supersetGroupId),
  true,
);
check(
  'enrichWithSupersetGroups clears ids',
  enrichWithSupersetGroups(withGroups, 'traditional').every((exercise) => !exercise.supersetGroupId),
  true,
);
check(
  'inferExecutionMode never promotes to superset',
  inferExecutionModeFromPlan(withGroups, 'traditional'),
  'traditional',
);
check(
  'explicit superset preference falls back to traditional',
  inferExecutionModeFromPlan(withGroups, 'superset'),
  'traditional',
);

console.log(`\n${failures === 0 ? 'Superset disabled: PASS' : `Superset disabled: ${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
