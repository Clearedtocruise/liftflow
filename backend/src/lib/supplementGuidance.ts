export type SupplementRecommendation = {
  name: string;
  rationale: string;
  priority: 'essential' | 'recommended' | 'optional';
};

type SupplementInput = {
  goal: 'fat_loss' | 'muscle_gain' | 'strength' | 'general_fitness';
  bodyWeightKg?: number;
  daysPerWeek?: number;
  currentSupplements?: string[];
  dietaryRestrictions?: string[];
};

function alreadyTaking(current: string[] | undefined, name: string): boolean {
  if (!current?.length) return false;
  const lower = name.toLowerCase();
  return current.some((s) => s.toLowerCase().includes(lower.split(' ')[0] ?? lower));
}

export function recommendSupplements(input: SupplementInput): SupplementRecommendation[] {
  const recs: SupplementRecommendation[] = [];
  const bw = input.bodyWeightKg ?? 75;
  const volume = input.daysPerWeek ?? 4;

  if (!alreadyTaking(input.currentSupplements, 'Whey protein')) {
    recs.push({
      name: 'Whey Protein',
      rationale:
        bw >= 70 || input.goal === 'muscle_gain'
          ? 'Convenient way to hit daily protein targets after training.'
          : 'Useful on busy days to support protein intake.',
      priority: input.goal === 'muscle_gain' ? 'recommended' : 'optional',
    });
  }

  if (!alreadyTaking(input.currentSupplements, 'Creatine')) {
    recs.push({
      name: 'Creatine Monohydrate',
      rationale: 'Well-researched for strength, power, and muscle performance.',
      priority: input.goal === 'strength' || input.goal === 'muscle_gain' ? 'essential' : 'recommended',
    });
  }

  if (volume >= 4 && !alreadyTaking(input.currentSupplements, 'Electrolytes')) {
    recs.push({
      name: 'Electrolytes',
      rationale: 'Supports hydration and performance during frequent training.',
      priority: 'recommended',
    });
  }

  if (!alreadyTaking(input.currentSupplements, 'Fish oil')) {
    recs.push({
      name: 'Fish Oil (Omega-3)',
      rationale: 'Supports recovery and general health — especially with high training load.',
      priority: 'recommended',
    });
  }

  if (!alreadyTaking(input.currentSupplements, 'Multivitamin')) {
    const restricted = input.dietaryRestrictions?.length ?? 0;
    recs.push({
      name: 'Multivitamin',
      rationale:
        restricted > 0
          ? 'Helps cover micronutrient gaps with dietary restrictions.'
          : 'Baseline micronutrient support for active training.',
      priority: restricted > 0 ? 'recommended' : 'optional',
    });
  }

  return recs.slice(0, 5);
}
