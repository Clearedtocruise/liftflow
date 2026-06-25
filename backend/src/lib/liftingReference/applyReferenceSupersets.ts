const HEAVY_COMPOUND_FAMILIES = new Set([
  'horizontal_press',
  'vertical_press',
  'vertical_pull',
  'horizontal_pull',
  'squat_pattern',
  'hinge_pattern',
]);

type SupersetCandidate = {
  block?: string;
  supersetGroupId?: string;
  metadata?: { movement_family?: string };
};

/** Apply A1/A2 block supersets from Month 1 prescriptions. Falls back to accessory-only pairing. */
export function applyBlockSupersets<T extends SupersetCandidate>(exercises: T[]): T[] {
  if (exercises.length === 0) return exercises;

  const result = exercises.map((exercise) => ({ ...exercise }));
  const blockGroups = new Map<string, number[]>();

  for (let i = 0; i < result.length; i++) {
    const block = result[i].block;
    if (!block) continue;
    const letter = block.charAt(0);
    if (!blockGroups.has(letter)) blockGroups.set(letter, []);
    blockGroups.get(letter)!.push(i);
  }

  for (const [letter, indices] of blockGroups) {
    if (indices.length < 2) continue;
    const groupId = `ss-${letter.toLowerCase()}`;
    for (const index of indices) {
      result[index] = { ...result[index], supersetGroupId: groupId };
    }
  }

  return result;
}

/** Pair accessories only — never two heavy compounds (adaptive generation fallback). */
export function enrichWithSmartSupersetGroups<
  T extends SupersetCandidate & { name?: string },
>(exercises: T[]): T[] {
  if (exercises.length < 2) return exercises;

  const result = exercises.map((exercise) => ({ ...exercise }));
  let groupCounter = 1;

  for (let i = 0; i + 1 < result.length; i++) {
    if (result[i].supersetGroupId) continue;

    const a = result[i];
    const b = result[i + 1];
    if (result[i + 1]?.supersetGroupId) continue;

    const aFamily = a.metadata?.movement_family ?? '';
    const bFamily = b.metadata?.movement_family ?? '';
    const aHeavy = HEAVY_COMPOUND_FAMILIES.has(aFamily);
    const bHeavy = HEAVY_COMPOUND_FAMILIES.has(bFamily);

    if (aHeavy && bHeavy) continue;
    if (aHeavy || bHeavy) continue;

    const groupId = `ss-${groupCounter}`;
    groupCounter += 1;
    result[i] = { ...result[i], supersetGroupId: groupId };
    result[i + 1] = { ...result[i + 1], supersetGroupId: groupId };
    i += 1;
  }

  return result;
}
