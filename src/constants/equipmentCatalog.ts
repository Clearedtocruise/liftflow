/** Granular gym equipment catalog — stored in Supabase `available_equipment` text arrays. */

export type EquipmentCategoryId =
  | 'free_weights'
  | 'racks_benches'
  | 'cable_machines'
  | 'bodyweight_accessories';

export type EquipmentItem = {
  id: string;
  label: string;
  category: EquipmentCategoryId;
  /** Requirement keys used by workoutPlanner exercise filtering */
  satisfies: string[];
};

export const EQUIPMENT_CATEGORIES: { id: EquipmentCategoryId; label: string }[] = [
  { id: 'free_weights', label: 'Free weights' },
  { id: 'racks_benches', label: 'Racks & benches' },
  { id: 'cable_machines', label: 'Cable & machines' },
  { id: 'bodyweight_accessories', label: 'Bodyweight & accessories' },
];

export const EQUIPMENT_CATALOG: EquipmentItem[] = [
  // Free weights
  { id: 'barbell', label: 'Barbell', category: 'free_weights', satisfies: ['barbell'] },
  { id: 'dumbbells', label: 'Dumbbells', category: 'free_weights', satisfies: ['dumbbells'] },
  { id: 'kettlebells', label: 'Kettlebells', category: 'free_weights', satisfies: ['kettlebells'] },
  { id: 'ez_curl_bar', label: 'EZ curl bar', category: 'free_weights', satisfies: ['barbell'] },
  { id: 'trap_bar', label: 'Trap / hex bar', category: 'free_weights', satisfies: ['barbell'] },
  { id: 'weight_plates', label: 'Weight plates', category: 'free_weights', satisfies: ['barbell'] },
  { id: 'landmine', label: 'Landmine / T-bar', category: 'free_weights', satisfies: ['landmine'] },
  // Racks & benches
  { id: 'squat_rack', label: 'Squat rack', category: 'racks_benches', satisfies: ['rack'] },
  { id: 'power_rack', label: 'Power rack', category: 'racks_benches', satisfies: ['rack'] },
  { id: 'smith_machine', label: 'Smith machine', category: 'racks_benches', satisfies: ['rack', 'machines'] },
  { id: 'flat_bench', label: 'Flat bench', category: 'racks_benches', satisfies: ['bench'] },
  { id: 'adjustable_bench', label: 'Adjustable bench', category: 'racks_benches', satisfies: ['bench'] },
  { id: 'preacher_bench', label: 'Preacher bench', category: 'racks_benches', satisfies: ['bench'] },
  { id: 'bench', label: 'Bench (general)', category: 'racks_benches', satisfies: ['bench'] },
  { id: 'rack', label: 'Rack (general)', category: 'racks_benches', satisfies: ['rack'] },
  // Cable & machines
  { id: 'cable_station', label: 'Cable station', category: 'cable_machines', satisfies: ['machines'] },
  { id: 'lat_pulldown', label: 'Lat pulldown', category: 'cable_machines', satisfies: ['machines'] },
  { id: 'seated_row_machine', label: 'Seated row machine', category: 'cable_machines', satisfies: ['machines'] },
  { id: 'leg_press', label: 'Leg press', category: 'cable_machines', satisfies: ['machines'] },
  { id: 'hack_squat', label: 'Hack squat', category: 'cable_machines', satisfies: ['machines'] },
  { id: 'chest_press_machine', label: 'Chest press machine', category: 'cable_machines', satisfies: ['machines'] },
  { id: 'pec_deck', label: 'Pec deck / fly machine', category: 'cable_machines', satisfies: ['machines'] },
  { id: 'shoulder_press_machine', label: 'Shoulder press machine', category: 'cable_machines', satisfies: ['machines'] },
  { id: 'leg_extension', label: 'Leg extension', category: 'cable_machines', satisfies: ['machines'] },
  { id: 'leg_curl', label: 'Leg curl', category: 'cable_machines', satisfies: ['machines'] },
  { id: 'calf_raise_machine', label: 'Calf raise machine', category: 'cable_machines', satisfies: ['machines'] },
  { id: 'machines', label: 'Selectorized machines (general)', category: 'cable_machines', satisfies: ['machines'] },
  // Bodyweight & accessories
  { id: 'bodyweight', label: 'Bodyweight only', category: 'bodyweight_accessories', satisfies: ['bodyweight'] },
  { id: 'pull_up_bar', label: 'Pull-up bar', category: 'bodyweight_accessories', satisfies: ['pull_up_bar'] },
  { id: 'dip_station', label: 'Dip station', category: 'bodyweight_accessories', satisfies: ['bodyweight'] },
  { id: 'resistance_bands', label: 'Resistance bands', category: 'bodyweight_accessories', satisfies: ['bands'] },
  { id: 'bands', label: 'Bands (general)', category: 'bodyweight_accessories', satisfies: ['bands'] },
  { id: 'ab_wheel', label: 'Ab wheel', category: 'bodyweight_accessories', satisfies: ['bodyweight'] },
  { id: 'medicine_ball', label: 'Medicine ball', category: 'bodyweight_accessories', satisfies: ['bodyweight'] },
  { id: 'full_gym', label: 'Full commercial gym (all equipment)', category: 'cable_machines', satisfies: ['full_gym'] },
];

export type EquipmentId = (typeof EQUIPMENT_CATALOG)[number]['id'];

export const ALL_EQUIPMENT_IDS = EQUIPMENT_CATALOG.map((item) => item.id);

const CATALOG_BY_ID = new Map(EQUIPMENT_CATALOG.map((item) => [item.id, item]));

export function getEquipmentLabel(id: string): string {
  return CATALOG_BY_ID.get(id)?.label ?? id.replace(/_/g, ' ');
}

export function equipmentByCategory(category: EquipmentCategoryId): EquipmentItem[] {
  return EQUIPMENT_CATALOG.filter((item) => item.category === category && item.id !== 'full_gym');
}

/** Expand stored equipment IDs into planner requirement keys. */
export function expandEquipmentRequirements(selected: string[]): Set<string> {
  if (selected.includes('full_gym')) {
    return new Set([
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
    ]);
  }

  const out = new Set<string>();
  for (const id of selected) {
    const item = CATALOG_BY_ID.get(id);
    if (item) {
      for (const key of item.satisfies) {
        if (key === 'full_gym') {
          return expandEquipmentRequirements(['full_gym']);
        }
        out.add(key);
      }
      continue;
    }
    // Legacy IDs stored before catalog expansion
    out.add(id);
  }
  return out;
}

function ids(...items: EquipmentId[]): EquipmentId[] {
  return items;
}

/** Preset equipment bundles — user can customize after applying. */
export const EQUIPMENT_PRESETS = {
  home_minimal: {
    label: 'Home Minimal',
    description: 'Bodyweight, bands, light dumbbells',
    equipment: ids('bodyweight', 'resistance_bands', 'dumbbells'),
  },
  home_gym: {
    label: 'Home Gym',
    description: 'Dumbbells, bench, bands, bodyweight',
    equipment: ids('bodyweight', 'dumbbells', 'adjustable_bench', 'resistance_bands', 'pull_up_bar'),
  },
  garage_gym: {
    label: 'Garage Gym',
    description: 'Barbell, rack, bench, dumbbells',
    equipment: ids(
      'barbell',
      'weight_plates',
      'power_rack',
      'flat_bench',
      'adjustable_bench',
      'dumbbells',
      'pull_up_bar',
      'resistance_bands',
    ),
  },
  planet_fitness: {
    label: 'Planet Fitness',
    description: 'Machines, dumbbells, smith — limited free barbells',
    equipment: ids(
      'dumbbells',
      'smith_machine',
      'flat_bench',
      'adjustable_bench',
      'cable_station',
      'lat_pulldown',
      'leg_press',
      'chest_press_machine',
      'pec_deck',
      'leg_extension',
      'leg_curl',
      'shoulder_press_machine',
      'seated_row_machine',
      'calf_raise_machine',
    ),
  },
  commercial_gym: {
    label: 'Commercial Gym',
    description: 'Typical big-box gym with free weights and machines',
    equipment: ids(
      'barbell',
      'dumbbells',
      'kettlebells',
      'power_rack',
      'squat_rack',
      'flat_bench',
      'adjustable_bench',
      'cable_station',
      'lat_pulldown',
      'leg_press',
      'hack_squat',
      'chest_press_machine',
      'leg_extension',
      'leg_curl',
      'pull_up_bar',
      'smith_machine',
      'landmine',
    ),
  },
  powerlifting_gym: {
    label: 'Powerlifting Gym',
    description: 'Competition racks, barbells, benches',
    equipment: ids(
      'barbell',
      'weight_plates',
      'trap_bar',
      'power_rack',
      'squat_rack',
      'flat_bench',
      'adjustable_bench',
      'dumbbells',
      'pull_up_bar',
      'cable_station',
    ),
  },
  full_gym: {
    label: 'Full Gym',
    description: 'Everything — all exercise options available',
    equipment: ids('full_gym'),
  },
} as const;

export type EquipmentPresetId = keyof typeof EQUIPMENT_PRESETS;

export const EQUIPMENT_PRESET_LIST = Object.entries(EQUIPMENT_PRESETS).map(([id, preset]) => ({
  id: id as EquipmentPresetId,
  ...preset,
}));

/** @deprecated Use EQUIPMENT_PRESETS.commercial_gym.equipment */
export const COMMERCIAL_GYM_EQUIPMENT: EquipmentId[] = [...EQUIPMENT_PRESETS.commercial_gym.equipment];

/** @deprecated Use EQUIPMENT_PRESETS.home_gym.equipment */
export const HOME_GYM_STARTER: EquipmentId[] = [...EQUIPMENT_PRESETS.home_gym.equipment];

/** Legacy flat list for backward-compatible imports */
export const EQUIPMENT_OPTIONS = EQUIPMENT_CATALOG.filter((item) => item.id !== 'full_gym').map((item) => ({
  id: item.id as EquipmentId,
  label: item.label,
}));

export function summarizeEquipment(selected: string[]): string {
  if (selected.includes('full_gym')) return 'Full gym';
  if (selected.length === 0) return 'None selected';
  if (selected.length <= 3) return selected.map(getEquipmentLabel).join(', ');
  return `${selected.length} items selected`;
}
