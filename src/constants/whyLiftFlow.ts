import { HeroImages } from '@/constants/imagery';

export type WhyLiftFlowSlide = {
  id: string;
  title: string;
  body: string | string[];
  image: string;
  cta?: string;
};

/** Three beats only — long decks before legal kill the hook. */
export const WHY_LIFTFLOW_SLIDES: WhyLiftFlowSlide[] = [
  {
    id: 'intro',
    title: 'ONE MORE',
    body: [
      'Not another generic plan.',
      '',
      'Your coach builds training, protein, and recovery around you — then keeps adapting.',
    ],
    image: HeroImages.whyLiftFlow.intro,
    cta: 'See how',
  },
  {
    id: 'adapts',
    title: 'BUILT FOR YOUR GYM',
    body: [
      'Home, commercial, or hotel — exercises match what you actually have.',
      '',
      '✓ Your schedule',
      '✓ Your equipment',
      '✓ Your recovery',
    ],
    image: HeroImages.whyLiftFlow.gym,
    cta: 'Continue',
  },
  {
    id: 'ready',
    title: 'WEEK ONE IN MINUTES',
    body: [
      'Answer a few questions.',
      'Get today’s workout and your protein target.',
      '',
      'Then open Home and start.',
    ],
    image: HeroImages.whyLiftFlow.succeed,
    cta: 'Build my plan',
  },
];
