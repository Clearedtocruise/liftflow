/**
 * Equipment requirement expansion for exercise filtering (mirrors src/constants/equipmentCatalog.ts).
 */

const SATISFIES: Record<string, string[]> = {
  barbell: ['barbell'],
  dumbbells: ['dumbbells'],
  kettlebells: ['dumbbells'],
  ez_curl_bar: ['barbell'],
  trap_bar: ['barbell'],
  weight_plates: ['barbell'],
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
  full_gym: ['full_gym'],
};

const ALL_REQUIREMENTS = [
  'bodyweight',
  'bands',
  'dumbbells',
  'bench',
  'pull_up_bar',
  'barbell',
  'rack',
  'machines',
] as const;

export function expandEquipmentRequirements(selected: string[]): Set<string> {
  if (selected.includes('full_gym')) {
    return new Set(ALL_REQUIREMENTS);
  }

  const out = new Set<string>();
  for (const id of selected) {
    const keys = SATISFIES[id];
    if (keys) {
      for (const key of keys) {
        if (key === 'full_gym') return expandEquipmentRequirements(['full_gym']);
        out.add(key);
      }
    } else {
      out.add(id);
    }
  }
  return out;
}
