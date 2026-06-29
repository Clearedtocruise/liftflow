/**
 * Curated hero imagery — each in-app surface gets its own photo ID.
 * Rule: no two banners visible on the same screen may share a URL.
 * Bundled assets are always tried first so banners never show blank grey.
 */

import type { ImageSource } from 'expo-image';

import { BundledLifestyle } from '@/constants/lifestyleAssets';

const u = (id: string, w = 800) =>
  `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;

export type LifestyleBannerSet = {
  sources: ImageSource[];
};

/** Primary bundled photo + remote fallbacks when online. */
export const LifestyleBannerSets = {
  workout: {
    sources: [
      BundledLifestyle.workoutTraining,
      BundledLifestyle.workoutLifting,
      { uri: u('photo-1571019614242-c5c5dee9f50b') },
      { uri: u('photo-1583454110551-21f2fa2afe61') },
      { uri: u('photo-1534438327276-14e5300c3a48') },
    ],
  },
  nutrition: {
    sources: [
      BundledLifestyle.nutritionFriends,
      BundledLifestyle.nutritionMeal,
      { uri: u('photo-1512621776951-a57141f2eefd') },
      { uri: u('photo-1555939594-58d7cb561ad1') },
    ],
  },
  rest: {
    sources: [
      BundledLifestyle.restYoga,
      BundledLifestyle.heroRest,
      { uri: u('photo-1544367567-0f2fcb009e0b') },
      { uri: u('photo-1541781774459-bb2af2f05b55') },
    ],
  },
  checkIn: {
    sources: [
      BundledLifestyle.checkInGroup,
      BundledLifestyle.workoutTraining,
      { uri: u('photo-1599058917212-d750089bc07e') },
    ],
  },
  heroWorkout: {
    sources: [
      BundledLifestyle.heroWorkout,
      BundledLifestyle.workoutTraining,
      { uri: u('photo-1583454110551-21f2fa2afe61') },
      { uri: u('photo-1571019614242-c5c5dee9f50b') },
    ],
  },
  heroRest: {
    sources: [
      BundledLifestyle.heroRest,
      BundledLifestyle.restYoga,
      { uri: u('photo-1541781774459-bb2af2f05b55') },
      { uri: u('photo-1544367567-0f2fcb009e0b') },
    ],
  },
} as const satisfies Record<string, LifestyleBannerSet>;

/** @deprecated Use LifestyleBannerSets.*.sources[0] or bundled assets directly. */
export function lifestyleUri(set: LifestyleBannerSet): string | undefined {
  const first = set.sources[0];
  return first && typeof first === 'object' && 'uri' in first ? first.uri : undefined;
}

export const HeroImages = {
  welcome: u('photo-1534438327276-14e5300c3a48', 1200),

  whyLiftFlow: {
    intro: u('photo-1571019614242-c5c5dee9f50b', 1200),
    notAnother: u('photo-1517836357463-d25dfeac3438', 1200),
    adapts: u('photo-1583454110551-21f2fa2afe61', 1200),
    gym: u('photo-1584466977772-494548441e48', 1200),
    aiCoach: u('photo-1599058917212-d750089bc07e', 1200),
    recovery: u('photo-1541781774459-bb2af2f05b55', 1200),
    nutrition: u('photo-1555939594-58d7cb561ad1', 1200),
    succeed: u('photo-1461896836934-ffe607ba8211', 1200),
    system: u('photo-1518611012118-696072aa579a', 1200),
  },

  onboarding: {
    location: u('photo-1534438327276-14e5300c3a48'),
    equipment: u('photo-1534438327276-14e5300c3a48'),
    goals: u('photo-1599058917212-d750089bc07e'),
    units: u('photo-1576678927484-cc907957088c'),
    metrics: u('photo-1517836357463-d25dfeac3438'),
  },

  goals: {
    muscle: u('photo-1461896836934-ffe607ba8211', 600),
    fatLoss: u('photo-1571019614242-c5c5dee9f50b', 600),
    strength: u('photo-1599058917212-d750089bc07e', 600),
    performance: u('photo-1461896836934-ffe607ba8211', 600),
    endurance: u('photo-1541781774459-bb2af2f05b55', 600),
    health: u('photo-1571019613454-1cb2f99b2d8b', 600),
    mobility: u('photo-1544367567-0f2fcb009e0b', 600),
    recovery: u('photo-1541781774459-bb2af2f05b55', 600),
  },

  /** Home — hero + cards; every key is a different person/scene. */
  dashboard: {
    heroWorkout: LifestyleBannerSets.heroWorkout.sources,
    heroRest: LifestyleBannerSets.heroRest.sources,
    cardWorkout: LifestyleBannerSets.workout.sources,
    cardRest: LifestyleBannerSets.rest.sources,
    nutrition: LifestyleBannerSets.nutrition.sources,
    nutritionPrep: LifestyleBannerSets.nutrition.sources,
    coach: u('photo-1594381898411-846e997d6008'),
    checkIn: LifestyleBannerSets.checkIn.sources,
  },

  tabs: {
    workout: u('photo-1583454110551-21f2fa2afe61'),
    progress: u('photo-1461896836934-ffe607ba8211'),
    history: u('photo-1434682883978-62c996d3323b'),
    settings: u('photo-1571019613454-1cb2f99b2d8b'),
    nutrition: u('photo-1555939594-58d7cb561ad1'),
  },
} as const;
