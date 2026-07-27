import { HeroImages } from '@/constants/imagery';

export type WhyLiftFlowSlide = {
  id: string;
  title: string;
  body: string | string[];
  image: string;
  cta?: string;
};

/** Tight post-signup intro — five beats, one idea each. */
export const WHY_LIFTFLOW_SLIDES: WhyLiftFlowSlide[] = [
  {
    id: 'intro',
    title: 'WHY ONE MORE',
    body: 'Generic apps hand everyone the same plan. ONE MORE builds around your goals, gym, schedule, and recovery — then keeps adapting.',
    image: HeroImages.whyLiftFlow.intro,
  },
  {
    id: 'adapts',
    title: 'TRAINING THAT ADAPTS',
    body: 'Exercise selection, volume, and intensity shift with your progress. When recovery dips, the plan pulls back. When you are ready, it pushes.',
    image: HeroImages.whyLiftFlow.adapts,
  },
  {
    id: 'gym',
    title: 'YOUR GYM. YOUR PLAN.',
    body: 'Home, garage, Planet Fitness, or a full commercial floor — ONE MORE picks exercises you can actually do. No guessing substitutions.',
    image: HeroImages.whyLiftFlow.gym,
  },
  {
    id: 'system',
    title: 'ONE SYSTEM',
    body: [
      'Training that matches your equipment',
      'Nutrition that moves with your load',
      'Recovery that tells you when to push',
      'Coaching that answers from your data',
    ],
    image: HeroImages.whyLiftFlow.system,
  },
  {
    id: 'build',
    title: 'BUILD YOURS',
    body: "A few minutes of setup. Then a training program, nutrition plan, and today's workout — tuned to you.",
    image: HeroImages.whyLiftFlow.aiCoach,
    cta: 'BUILD MY PLAN',
  },
];
