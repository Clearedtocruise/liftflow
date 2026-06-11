/**
 * Muscle taxonomy for the Exercise Card System.
 *
 * Each MuscleId maps to a display label, the body region it belongs to (used by
 * the animated anatomy figure to decide which view shows it), and the anatomy
 * "slot" the SVG figure highlights. Keep this list aligned with the body areas
 * referenced across the exercise database so highlighting stays consistent as
 * the catalog grows toward 500+ exercises.
 */

export type MuscleId =
  | 'chest'
  | 'front-delts'
  | 'side-delts'
  | 'rear-delts'
  | 'shoulders'
  | 'triceps'
  | 'biceps'
  | 'forearms'
  | 'lats'
  | 'mid-back'
  | 'upper-back'
  | 'traps'
  | 'lower-back'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'abs'
  | 'obliques'
  | 'core'
  | 'neck'
  | 'hip-flexors'
  | 'adductors'
  | 'abductors'
  | 'full-body';

/** Which silhouette best shows a muscle, used to auto-pick the default view. */
export type AnatomyView = 'front' | 'side' | 'rear';

type MuscleMeta = {
  label: string;
  /** Views on which this muscle is visibly highlighted. */
  views: AnatomyView[];
  /** Anatomy region slot the SVG figure fills when this muscle is active. */
  region: AnatomyRegion;
};

/**
 * Coarse regions the figure can highlight. Several muscles can share a region
 * (e.g. front/side delts both light the shoulder caps) which keeps the figure
 * legible without needing a unique polygon per tiny muscle.
 */
export type AnatomyRegion =
  | 'chest'
  | 'shoulder'
  | 'upper-arm-front'
  | 'upper-arm-back'
  | 'forearm'
  | 'lats'
  | 'upper-back'
  | 'traps'
  | 'lower-back'
  | 'abs'
  | 'obliques'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'neck'
  | 'hips'
  | 'full-body';

export const MUSCLES: Record<MuscleId, MuscleMeta> = {
  chest: { label: 'Chest', views: ['front'], region: 'chest' },
  'front-delts': { label: 'Front Delts', views: ['front', 'side'], region: 'shoulder' },
  'side-delts': { label: 'Side Delts', views: ['front', 'rear', 'side'], region: 'shoulder' },
  'rear-delts': { label: 'Rear Delts', views: ['rear', 'side'], region: 'shoulder' },
  shoulders: { label: 'Shoulders', views: ['front', 'rear', 'side'], region: 'shoulder' },
  triceps: { label: 'Triceps', views: ['rear', 'side'], region: 'upper-arm-back' },
  biceps: { label: 'Biceps', views: ['front', 'side'], region: 'upper-arm-front' },
  forearms: { label: 'Forearms', views: ['front', 'rear', 'side'], region: 'forearm' },
  lats: { label: 'Lats', views: ['rear', 'side'], region: 'lats' },
  'mid-back': { label: 'Mid Back', views: ['rear'], region: 'upper-back' },
  'upper-back': { label: 'Upper Back', views: ['rear'], region: 'upper-back' },
  traps: { label: 'Traps', views: ['rear', 'front'], region: 'traps' },
  'lower-back': { label: 'Lower Back', views: ['rear', 'side'], region: 'lower-back' },
  quads: { label: 'Quads', views: ['front', 'side'], region: 'quads' },
  hamstrings: { label: 'Hamstrings', views: ['rear', 'side'], region: 'hamstrings' },
  glutes: { label: 'Glutes', views: ['rear', 'side'], region: 'glutes' },
  calves: { label: 'Calves', views: ['rear', 'side', 'front'], region: 'calves' },
  abs: { label: 'Abs', views: ['front', 'side'], region: 'abs' },
  obliques: { label: 'Obliques', views: ['front', 'side'], region: 'obliques' },
  core: { label: 'Core', views: ['front', 'side'], region: 'abs' },
  neck: { label: 'Neck', views: ['front', 'rear', 'side'], region: 'neck' },
  'hip-flexors': { label: 'Hip Flexors', views: ['front', 'side'], region: 'hips' },
  adductors: { label: 'Adductors', views: ['front'], region: 'quads' },
  abductors: { label: 'Abductors', views: ['rear', 'side'], region: 'glutes' },
  'full-body': { label: 'Full Body', views: ['front'], region: 'full-body' },
};

export function muscleLabel(id: MuscleId): string {
  return MUSCLES[id]?.label ?? id;
}

export function muscleLabels(ids: MuscleId[] = []): string[] {
  return ids.map(muscleLabel);
}

/**
 * Pick the most informative default anatomy view for a set of muscles.
 * Back-dominant movements open on the rear view, etc.
 */
export function defaultViewForMuscles(primary: MuscleId[] = []): AnatomyView {
  const score: Record<AnatomyView, number> = { front: 0, side: 0, rear: 0 };
  for (const id of primary) {
    for (const view of MUSCLES[id]?.views ?? []) {
      score[view] += 1;
    }
  }
  if (score.rear > score.front && score.rear >= score.side) return 'rear';
  if (score.side > score.front && score.side > score.rear) return 'side';
  return 'front';
}

/** All anatomy regions a muscle set lights up on a given view. */
export function activeRegions(muscles: MuscleId[], view: AnatomyView): AnatomyRegion[] {
  const regions = new Set<AnatomyRegion>();
  for (const id of muscles) {
    const meta = MUSCLES[id];
    if (!meta) continue;
    if (meta.views.includes(view) || meta.region === 'full-body') {
      regions.add(meta.region);
    }
  }
  return Array.from(regions);
}
