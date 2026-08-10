type SupersetCandidate = {
  block?: string;
  supersetGroupId?: string;
  metadata?: { movement_family?: string };
};

function stripSupersetGroupId<T extends SupersetCandidate>(exercise: T): T {
  if (!exercise.supersetGroupId) return exercise;
  const { supersetGroupId: _removed, ...rest } = exercise;
  return rest as T;
}

/**
 * Supersets are disabled — the in-workout rotation flow was unreliable, so every session
 * runs as straight sets. These helpers stay as strip-passes so callers and saved plans
 * with leftover group ids do not re-enable pairing.
 */
export function applyBlockSupersets<T extends SupersetCandidate>(exercises: T[]): T[] {
  return exercises.map(stripSupersetGroupId);
}

/** @see applyBlockSupersets — smart accessory pairing is off. */
export function enrichWithSmartSupersetGroups<
  T extends SupersetCandidate & { name?: string },
>(exercises: T[]): T[] {
  return exercises.map(stripSupersetGroupId);
}
