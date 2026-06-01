import { HeroImages } from '@/constants/imagery';
import type { TrainingGoalId } from '@/constants/trainingGoals';

export type PremiumGoalId =
  | 'build_muscle'
  | 'burn_fat'
  | 'increase_strength'
  | 'athletic_performance'
  | 'endurance'
  | 'improve_health'
  | 'mobility'
  | 'recovery'
  | 'injury_prevention'
  | 'mental_wellness';

export type PremiumGoalOption = {
  id: PremiumGoalId;
  label: string;
  icon: string;
  description: string;
  image: string;
  /** Maps to existing backend training goal IDs */
  backendIds: TrainingGoalId[];
};

export const PREMIUM_GOAL_OPTIONS: PremiumGoalOption[] = [
  {
    id: 'build_muscle',
    label: 'Build Muscle',
    icon: '💪',
    description: 'Hypertrophy volume, progressive overload, protein-forward nutrition.',
    image: HeroImages.goals.muscle,
    backendIds: ['muscle_gain', 'hypertrophy'],
  },
  {
    id: 'burn_fat',
    label: 'Burn Fat',
    icon: '🔥',
    description: 'Calorie-aware training with metabolic conditioning.',
    image: HeroImages.goals.fatLoss,
    backendIds: ['fat_loss', 'weight_loss'],
  },
  {
    id: 'increase_strength',
    label: 'Increase Strength',
    icon: '🏆',
    description: 'Heavy compounds, lower reps, longer rest periods.',
    image: HeroImages.goals.strength,
    backendIds: ['strength'],
  },
  {
    id: 'athletic_performance',
    label: 'Athletic Performance',
    icon: '⚡',
    description: 'Power, speed, and balanced athletic capacity.',
    image: HeroImages.goals.performance,
    backendIds: ['general_fitness'],
  },
  {
    id: 'endurance',
    label: 'Endurance',
    icon: '🏃',
    description: 'Cardio capacity and muscular endurance progressions.',
    image: HeroImages.goals.endurance,
    backendIds: ['endurance'],
  },
  {
    id: 'improve_health',
    label: 'Improve Health',
    icon: '❤️',
    description: 'Sustainable movement for long-term wellness.',
    image: HeroImages.goals.health,
    backendIds: ['general_fitness'],
  },
  {
    id: 'mobility',
    label: 'Mobility',
    icon: '🧘',
    description: 'Joint health, flexibility, and movement quality.',
    image: HeroImages.goals.mobility,
    backendIds: ['mobility'],
  },
  {
    id: 'recovery',
    label: 'Recovery',
    icon: '😴',
    description: 'Deload-aware programming and recovery-first pacing.',
    image: HeroImages.goals.recovery,
    backendIds: ['mobility'],
  },
  {
    id: 'injury_prevention',
    label: 'Injury Prevention',
    icon: '🛡️',
    description: 'Prehab patterns and smart exercise selection.',
    image: HeroImages.goals.mobility,
    backendIds: ['mobility'],
  },
  {
    id: 'mental_wellness',
    label: 'Mental Wellness',
    icon: '🧠',
    description: 'Training as stress relief and mood support.',
    image: HeroImages.goals.health,
    backendIds: ['general_fitness'],
  },
];

export function premiumGoalsToRankedBackendIds(selected: PremiumGoalId[]): TrainingGoalId[] {
  const out: TrainingGoalId[] = [];
  for (const id of selected) {
    const opt = PREMIUM_GOAL_OPTIONS.find((g) => g.id === id);
    if (!opt) continue;
    for (const bid of opt.backendIds) {
      if (!out.includes(bid)) out.push(bid);
    }
  }
  return out.slice(0, 4);
}

export function rankedBackendToPremium(selected: TrainingGoalId[]): PremiumGoalId[] {
  const out: PremiumGoalId[] = [];
  for (const goal of PREMIUM_GOAL_OPTIONS) {
    if (goal.backendIds.some((id) => selected.includes(id)) && !out.includes(goal.id)) {
      out.push(goal.id);
    }
  }
  return out;
}
