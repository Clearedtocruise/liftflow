import { HeroImages } from '@/constants/imagery';

export type WhyLiftFlowSlide = {
  id: string;
  title: string;
  body: string | string[];
  image: string;
  cta?: string;
};

export const WHY_LIFTFLOW_SLIDES: WhyLiftFlowSlide[] = [
  {
    id: 'intro',
    title: 'WHY LIFTFLOW',
    body: ['Train Smarter. Progress Faster.', 'Recover Faster. Live Better. Earn More.', '', 'Unlike generic fitness apps, LiftFlow adapts to YOU.'],
    image: HeroImages.whyLiftFlow.intro,
  },
  {
    id: 'not-another',
    title: 'NOT ANOTHER WORKOUT APP',
    body: [
      'Most fitness apps give everyone the same plan.',
      '',
      'LiftFlow builds around:',
      '• Your goals',
      '• Your equipment',
      '• Your schedule',
      '• Your recovery',
      '• Your progress',
    ],
    image: HeroImages.whyLiftFlow.notAnother,
  },
  {
    id: 'adapts',
    title: 'TRAINING THAT ADAPTS',
    body: [
      'LiftFlow continuously adjusts:',
      '• Exercise selection',
      '• Volume & intensity',
      '• Recovery recommendations',
      '• Nutrition targets',
    ],
    image: HeroImages.whyLiftFlow.adapts,
  },
  {
    id: 'gym',
    title: 'YOUR GYM. YOUR PLAN.',
    body: [
      'Whether you train at:',
      '• Home Gym',
      '• Garage Gym',
      '• Planet Fitness',
      '• Commercial Gym',
      '• Hotel Gym',
      '',
      'LiftFlow adapts automatically. No more guessing substitutions.',
    ],
    image: HeroImages.whyLiftFlow.gym,
  },
  {
    id: 'ai-coach',
    title: 'AI COACHING',
    body: [
      'Ask:',
      '• What weight should I use?',
      '• What did I do last time?',
      '• Why did my workout change?',
      '• What should I eat today?',
      '',
      'LiftFlow answers using your actual data.',
    ],
    image: HeroImages.whyLiftFlow.aiCoach,
  },
  {
    id: 'recovery',
    title: 'RECOVERY MATTERS',
    body: [
      'LiftFlow tracks:',
      '• Sleep',
      '• Energy',
      '• Stress',
      '• Soreness',
      '• Training load',
      '',
      'Train hard when ready. Recover when needed.',
    ],
    image: HeroImages.whyLiftFlow.recovery,
  },
  {
    id: 'nutrition',
    title: 'NUTRITION THAT ADAPTS',
    body: [
      'LiftFlow adjusts calories, protein, carbs, fat, and water based on your goal, recovery, and training volume.',
    ],
    image: HeroImages.whyLiftFlow.nutrition,
  },
  {
    id: 'succeed',
    title: 'WHY USERS SUCCEED',
    body: [
      'Research consistently shows:',
      '• Structured plans outperform random workouts',
      '• Tracking improves adherence',
      '• Recovery improves performance',
      '• Personalized plans improve consistency',
      '',
      'LiftFlow combines all four.',
    ],
    image: HeroImages.whyLiftFlow.succeed,
  },
  {
    id: 'system',
    title: 'YOUR PERSONALIZED SYSTEM',
    body: ['✓ Training', '✓ Recovery', '✓ Nutrition', '✓ Progress', '✓ AI Coaching', '', "Let's build yours."],
    image: HeroImages.whyLiftFlow.system,
    cta: 'BUILD MY PLAN',
  },
];
