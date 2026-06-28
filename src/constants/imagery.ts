/**
 * Curated hero imagery — each in-app surface gets its own photo ID.
 * Rule: no two banners visible on the same screen may share a URL.
 */

const u = (id: string, w = 800) =>
  `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;

export const HeroImages = {
  welcome: u('photo-1534438327276-14e5300c3a48', 1200),

  whyLiftFlow: {
    intro: u('photo-1571019614242-c5c5dee9f50b', 1200),
    notAnother: u('photo-1517836357463-d25dfeac3438', 1200),
    adapts: u('photo-1583454110551-21f2fa2afe61', 1200),
    gym: u('photo-1584466977772-494548441e48', 1200),
    aiCoach: u('photo-1599058917212-d750089bc07e', 1200),
    recovery: u('photo-1541781774459-bb2af2f05b55', 1200),
    nutrition: u('photo-1490645935967-10de28ba6953', 1200),
    succeed: u('photo-1461896836934-ffe607ba8211', 1200),
    system: u('photo-1518611012118-696072aa579a', 1200),
  },

  onboarding: {
    location: u('photo-1534438327276-14e5300c3a48'),
    equipment: u('photo-1574680096145-d05b8e3ed504'),
    goals: u('photo-1575052814086-5119108a8ead'),
    units: u('photo-1576678927484-cc907957088c'),
    metrics: u('photo-1517836357463-d25dfeac3438'),
  },

  goals: {
    muscle: u('photo-1581009146145-b5ef050c149a', 600),
    fatLoss: u('photo-1571019614242-c5c5dee9f50b', 600),
    strength: u('photo-1599058917212-d750089bc07e', 600),
    performance: u('photo-1461896836934-ffe607ba8211', 600),
    endurance: u('photo-1476480862128-209bfaa8edc5', 600),
    health: u('photo-1571019613454-1cb2f99b2d8b', 600),
    mobility: u('photo-1544367567-0f2fcb009e0b', 600),
    recovery: u('photo-1541781774459-bb2af2f05b55', 600),
  },

  /** Home — hero + cards; every key is a different person/scene. */
  dashboard: {
    /** Top hero — smiling athlete, wide energy. */
    heroWorkout: u('photo-1575052814086-5119108a8ead'),
    /** Top hero — rest day trail / calm recovery. */
    heroRest: u('photo-1476480862128-209bfaa8edc5'),
    /** Workout card strip — solo lifter. */
    cardWorkout: u('photo-1574680096145-d05b8e3ed504'),
    /** Rest-day card — yoga stretch. */
    cardRest: u('photo-1544367567-0f2fcb009e0b'),
    /** Nutrition card — friends eating & smiling. */
    nutrition: u('photo-1512621776951-a57141f2eefd'),
    /** Meal prep / kitchen (Meals tab hero, not Home card). */
    nutritionPrep: u('photo-1555939594-58d7cb561ad1'),
    /** Coach message card — trainer with client. */
    coach: u('photo-1594381898411-846e997d6008'),
    /** Daily check-in cue — outdoor group fitness, happy. */
    checkIn: u('photo-1554287406-c62edd4dca35'),
  },

  /** Main tab headers — each distinct from Home dashboard slots. */
  tabs: {
    workout: u('photo-1583454110551-21f2fa2afe61'),
    progress: u('photo-1581009146145-b5ef050c149a'),
    history: u('photo-1434682883978-62c996d3323b'),
    settings: u('photo-1571019613454-1cb2f99b2d8b'),
    nutrition: u('photo-1498837167922-ddd27584619e'),
  },
} as const;
