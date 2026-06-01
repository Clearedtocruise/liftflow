export function estimateOneRepMax(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export function parseRepRange(reps: string): number {
  const match = reps.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 8;
}

export type ProgressionSnapshot = {
  exerciseName: string;
  exerciseSlug?: string;
  weight: number;
  reps: number;
  estimated1Rm: number;
  volume: number;
  weekNumber: number;
};

export type SessionPerformance = {
  weight: number;
  reps: number;
  hitTarget: boolean;
};

export function computeLoadAdjustment(
  priorSessions: SessionPerformance[],
  currentWeight: number,
  recoveryVolumeMultiplier = 1,
): { weightLbs: number; reps: string; note?: string } {
  const targetHits = priorSessions.filter((s) => s.hitTarget).length;
  const recentMisses = priorSessions.filter((s) => !s.hitTarget).length;

  if (targetHits >= 2) {
    const pct = 0.025 + Math.min(0.025, targetHits * 0.005);
    const delta = Math.max(2.5, Math.round(currentWeight * pct * 2) / 2);
    return {
      weightLbs: Math.round((currentWeight + delta) * 10) / 10,
      reps: `${parseRepRange('8')}`,
      note: `+${delta} after ${targetHits} consecutive target sessions`,
    };
  }

  if (recentMisses >= 2) {
    const delta = Math.max(2.5, Math.round(currentWeight * 0.05 * 2) / 2);
    return {
      weightLbs: Math.max(0, Math.round((currentWeight - delta) * 10) / 10),
      reps: `${parseRepRange('8')}`,
      note: `−${delta} after repeated missed reps`,
    };
  }

  const last = priorSessions[0];
  if (last && !last.hitTarget && last.reps > 0) {
    return {
      weightLbs: currentWeight,
      reps: `${Math.min(last.reps + 1, parseRepRange('8'))}-${parseRepRange('8')}`,
      note: 'Rep progression before load increase',
    };
  }

  return {
    weightLbs: currentWeight,
    reps: '8',
    note: recoveryVolumeMultiplier < 0.85 ? 'Recovery-adjusted — hold load' : undefined,
  };
}

export function applyWeeklyProgression(
  exercises: Array<{ name: string; sets: number; reps: string; weightLbs?: number; restSeconds: number; notes?: string }>,
  priorPerformance: Map<string, { weight: number; reps: number; sessions?: SessionPerformance[] }>,
  phaseIntensityMultiplier: number,
  recoveryVolumeMultiplier = 1,
): typeof exercises {
  return exercises.map((exercise) => {
    const slug = exercise.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const prior = priorPerformance.get(slug);
    let weightLbs = exercise.weightLbs;
    let reps = exercise.reps;
    let progressionNote: string | undefined;

    if (prior) {
      const targetReps = parseRepRange(exercise.reps);
      const sessions: SessionPerformance[] = prior.sessions ?? [
        { weight: prior.weight, reps: prior.reps, hitTarget: prior.reps >= targetReps },
      ];

      const adjusted = computeLoadAdjustment(sessions, prior.weight, recoveryVolumeMultiplier);
      weightLbs = Math.round(adjusted.weightLbs * phaseIntensityMultiplier / 2.5) * 2.5;
      reps = adjusted.reps;
      progressionNote = adjusted.note;
    }

    let sets = exercise.sets;
    if (recoveryVolumeMultiplier < 0.75) {
      sets = Math.max(1, Math.round(sets * recoveryVolumeMultiplier));
    } else if (recoveryVolumeMultiplier > 1.05) {
      sets = Math.round(sets * Math.min(recoveryVolumeMultiplier, 1.15));
    }

    const e1rm = weightLbs ? estimateOneRepMax(weightLbs, parseRepRange(reps)) : undefined;

    return {
      ...exercise,
      sets,
      weightLbs,
      reps,
      notes: [exercise.notes, progressionNote, e1rm ? `Target e1RM ~${e1rm} lb` : undefined]
        .filter(Boolean)
        .join(' · '),
    };
  });
}

export function totalPlannedVolume(
  exercises: Array<{ sets: number; reps: string; weightLbs?: number }>,
): number {
  return exercises.reduce((sum, ex) => {
    const reps = parseRepRange(ex.reps);
    return sum + ex.sets * reps * (ex.weightLbs ?? 0);
  }, 0);
}
