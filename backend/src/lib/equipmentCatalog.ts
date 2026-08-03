/**
 * Equipment requirement expansion for exercise filtering (mirrors src/constants/equipmentCatalog.ts).
 */

const SATISFIES: Record<string, string[]> = {
  barbell: ['barbell'],
  dumbbells: ['dumbbells'],
  kettlebells: ['kettlebells'],
  ez_curl_bar: ['barbell'],
  trap_bar: ['barbell'],
  weight_plates: ['barbell'],
  landmine: ['landmine'],
  squat_rack: ['rack'],
  power_rack: ['rack'],
  smith_machine: ['rack', 'machines'],
  flat_bench: ['bench'],
  adjustable_bench: ['bench'],
  preacher_bench: ['bench'],
  bench: ['bench'],
  rack: ['rack'],
  cable_station: ['machines'],
  lat_pulldown: ['machines'],
  seated_row_machine: ['machines'],
  leg_press: ['machines'],
  hack_squat: ['machines'],
  chest_press_machine: ['machines'],
  pec_deck: ['machines'],
  shoulder_press_machine: ['machines'],
  leg_extension: ['machines'],
  leg_curl: ['machines'],
  calf_raise_machine: ['machines'],
  machines: ['machines'],
  bodyweight: ['bodyweight'],
  pull_up_bar: ['pull_up_bar'],
  dip_station: ['bodyweight'],
  resistance_bands: ['bands'],
  bands: ['bands'],
  ab_wheel: ['bodyweight'],
  medicine_ball: ['bodyweight'],
  // A suspension trainer is a separate purchase, not something you have by virtue of having a body.
  suspension_trainer: ['suspension'],
  gymnastic_rings: ['suspension'],
  full_gym: ['full_gym'],
};

/**
 * Requirements a "full gym" covers. Specialty implements a gym may or may not own are deliberately
 * excluded, so they are only ever programmed when the user ticks them explicitly.
 */
const ALL_REQUIREMENTS = [
  'bodyweight',
  'bands',
  'dumbbells',
  'kettlebells',
  'bench',
  'pull_up_bar',
  'barbell',
  'rack',
  'machines',
  'landmine',
] as const;

export function expandEquipmentRequirements(selected: string[]): Set<string> {
  // Bodyweight needs no equipment, so it is available at every training location. Gym presets that
  // omit it were silently filtering push-ups, planks and sit-ups out of the exercise pool.
  const out = new Set<string>(['bodyweight']);

  // "Full gym" is additive rather than absolute: it grants the standard requirements, but a user who
  // also ticks a suspension trainer still gets one. Returning a fixed set discarded those picks.
  if (selected.includes('full_gym')) {
    for (const key of ALL_REQUIREMENTS) out.add(key);
  }

  for (const id of selected) {
    if (id === 'full_gym') continue;
    const keys = SATISFIES[id];
    if (keys) {
      for (const key of keys) {
        if (key === 'full_gym') {
          for (const full of ALL_REQUIREMENTS) out.add(full);
          continue;
        }
        out.add(key);
      }
    } else {
      out.add(id);
    }
  }
  return out;
}

/**
 * TRX and rings are stored in the catalog as `bodyweight`, so the stored equipment column cannot be
 * trusted to gate them. The name is the reliable signal, exactly as it is for movement families.
 */
const SUSPENSION_NAME_PATTERN = /\btrx\b|\bsuspension\b|\bgymnastic\s+rings?\b/i;
/** Anything named "Ring <movement>" is a gymnastic ring exercise. */
const RING_PREFIX_PATTERN = /^\s*rings?\s+\S/i;

export function requiresSuspensionTrainer(name?: string | null, slug?: string | null): boolean {
  const readableSlug = (slug ?? '').replace(/[-_]+/g, ' ');
  const key = `${name ?? ''} ${readableSlug}`.trim();
  if (!key) return false;
  return (
    SUSPENSION_NAME_PATTERN.test(key) ||
    RING_PREFIX_PATTERN.test(name ?? '') ||
    RING_PREFIX_PATTERN.test(readableSlug)
  );
}
