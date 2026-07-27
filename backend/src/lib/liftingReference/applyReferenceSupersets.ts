const HEAVY_COMPOUND_FAMILIES = new Set([
  'horizontal_press',
  'vertical_press',
  'vertical_pull',
  'horizontal_pull',
  'squat_pattern',
  'hinge_pattern',
]);

/** B1/B2-style stations. Bare letters (A, D) are compounds that stand alone. */
const NUMBERED_BLOCK = /^[A-Za-z]\d+$/;

type SupersetCandidate = {
  block?: string;
  supersetGroupId?: string;
  metadata?: { movement_family?: string };
};

/**
 * Apply A1/A2 block supersets from Month 1 prescriptions.
 * Only numbered stations (B1/B2, C1/C2) pair — bare A/D compounds never do.
 */
export function applyBlockSupersets<T extends SupersetCandidate>(exercises: T[]): T[] {
  if (exercises.length === 0) return exercises;

  const result = exercises.map((exercise) => ({ ...exercise }));
  const blockGroups = new Map<string, number[]>();

  for (let i = 0; i < result.length; i++) {
    const block = result[i].block?.trim();
    if (!block || !NUMBERED_BLOCK.test(block)) continue;
    const letter = block.charAt(0).toLowerCase();
    if (!blockGroups.has(letter)) blockGroups.set(letter, []);
    blockGroups.get(letter)!.push(i);
  }

  for (const [letter, indices] of blockGroups) {
    // Pair consecutive numbered stations (B1+B2, B3+B4) rather than one giant set when a
    // letter somehow has more than two members.
    for (let i = 0; i + 1 < indices.length; i += 2) {
      const groupId = indices.length === 2 ? `ss-${letter}` : `ss-${letter}${Math.floor(i / 2) + 1}`;
      const a = indices[i]!;
      const b = indices[i + 1]!;
      result[a] = { ...result[a], supersetGroupId: groupId };
      result[b] = { ...result[b], supersetGroupId: groupId };
    }
  }

  return result;
}

/**
 * Pair accessories only — never two heavy compounds, and never exercises whose movement
 * family is unknown. Missing metadata used to look like "accessory", which paired every
 * adjacent lift and made whole workouts run as supersets.
 */
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

    const aFamily = a.metadata?.movement_family?.trim() ?? '';
    const bFamily = b.metadata?.movement_family?.trim() ?? '';
    // Unknown family ⇒ do not invent a pairing. The empty-string path was the production bug.
    if (!aFamily || !bFamily) continue;

    const aHeavy = HEAVY_COMPOUND_FAMILIES.has(aFamily);
    const bHeavy = HEAVY_COMPOUND_FAMILIES.has(bFamily);

    if (aHeavy || bHeavy) continue;

    const groupId = `ss-${groupCounter}`;
    groupCounter += 1;
    result[i] = { ...result[i], supersetGroupId: groupId };
    result[i + 1] = { ...result[i + 1], supersetGroupId: groupId };
    i += 1;
  }

  return result;
}
