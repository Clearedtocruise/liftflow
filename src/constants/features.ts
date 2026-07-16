/**
 * ONE MORE feature registry.
 * Maps route keys to feature metadata for placeholder screens and navigation hub.
 * Phase indicates planned delivery timeline.
 */

export type FeaturePhase = 'mvp' | 'phase1' | 'phase2' | 'phase3' | 'phase4';

export type FeatureDefinition = {
  id: string;
  title: string;
  description: string;
  phase: FeaturePhase;
  category: FeatureCategory;
  route: string;
  icon: string;
};

export type FeatureCategory =
  | 'workout'
  | 'training'
  | 'ai'
  | 'nutrition'
  | 'body'
  | 'analytics'
  | 'integrations'
  | 'platform';

export const FEATURES: FeatureDefinition[] = [
  // MVP
  { id: 'voice-logging', title: 'Voice Logging', description: 'Log sets by speaking naturally', phase: 'mvp', category: 'workout', route: '/(tabs)/workout', icon: 'mic.fill' },
  { id: 'workout-history', title: 'Workout History', description: 'Past sessions, PRs, and trends', phase: 'mvp', category: 'workout', route: '/(tabs)/history', icon: 'clock.arrow.circlepath' },

  // Phase 1
  { id: 'workout-planning', title: 'Workout Planning', description: 'Schedule and plan upcoming sessions', phase: 'phase1', category: 'training', route: '/(features)/workout-planning', icon: 'calendar' },
  { id: 'training-phases', title: 'Training Phases', description: 'Hypertrophy, strength, deload cycles', phase: 'phase1', category: 'training', route: '/(features)/training-phases', icon: 'chart.line.uptrend.xyaxis' },
  { id: 'coach-chat', title: 'ONE MORE Coach', description: 'Conversational AI coaching with memory', phase: 'phase1', category: 'ai', route: '/(features)/coach-chat', icon: 'bubble.left.and.bubble.right.fill' },
  { id: 'nutrition-intelligence', title: 'Nutrition Intelligence', description: 'AI macros, meals, and grocery plans', phase: 'phase1', category: 'nutrition', route: '/(features)/nutrition-intelligence', icon: 'leaf.circle.fill' },
  { id: 'suggested-workouts', title: 'Suggested Workouts', description: 'AI-generated workout recommendations', phase: 'phase1', category: 'ai', route: '/(features)/suggested-workouts', icon: 'sparkles' },
  { id: 'suggested-muscles', title: 'Suggested Muscle Groups', description: 'Recovery-aware muscle targeting', phase: 'phase1', category: 'ai', route: '/(features)/suggested-muscles', icon: 'figure.strengthtraining.traditional' },
  { id: 'recovery-analysis', title: 'Recovery Analysis', description: 'Fatigue and readiness assessment', phase: 'phase1', category: 'ai', route: '/(features)/recovery-analysis', icon: 'bed.double.fill' },
  { id: 'progression-tracking', title: 'Progression Tracking', description: 'Weight and rep trends over time', phase: 'phase1', category: 'analytics', route: '/(features)/progression-tracking', icon: 'arrow.up.right' },
  { id: 'ai-coaching', title: 'AI Coaching', description: 'Evidence-based fitness coaching', phase: 'phase1', category: 'ai', route: '/(features)/ai-coaching', icon: 'brain.head.profile' },
  { id: 'ai-insights', title: 'AI Insights', description: 'Educational training explanations', phase: 'phase1', category: 'ai', route: '/(features)/ai-insights', icon: 'lightbulb.fill' },
  { id: 'rest-timers', title: 'Rest Timers', description: 'Intelligent rest between sets', phase: 'phase1', category: 'workout', route: '/(tabs)/workout', icon: 'timer' },
  { id: 'set-duration', title: 'Set Duration Tracking', description: 'Time under tension per set', phase: 'phase1', category: 'workout', route: '/(features)/set-duration', icon: 'stopwatch.fill' },
  { id: 'workout-density', title: 'Workout Density', description: 'Volume and rest efficiency metrics', phase: 'phase1', category: 'analytics', route: '/(features)/workout-density', icon: 'gauge.with.needle.fill' },

  // Phase 2
  { id: 'peak-music', title: 'Peak Music Sync', description: 'Sync song peaks with rest timers', phase: 'phase2', category: 'integrations', route: '/(features)/peak-music-settings', icon: 'music.note' },
  { id: 'cardio-tracking', title: 'Cardio Tracking', description: 'Run, cycle, HIIT, and more', phase: 'phase1', category: 'workout', route: '/(features)/cardio-tracking', icon: 'figure.run' },
  { id: 'heart-rate', title: 'Heart Rate Tracking', description: 'HR during workouts and rest', phase: 'phase2', category: 'integrations', route: '/(features)/heart-rate', icon: 'heart.fill' },
  { id: 'healthkit', title: 'Apple HealthKit', description: 'Sync health and fitness data', phase: 'phase2', category: 'integrations', route: '/(features)/healthkit', icon: 'heart.text.square.fill' },
  { id: 'apple-watch', title: 'Apple Watch', description: 'Workout companion on wrist', phase: 'phase2', category: 'integrations', route: '/(features)/apple-watch', icon: 'applewatch' },
  { id: 'motion-detection', title: 'Motion Detection', description: 'Movement pattern analysis', phase: 'phase2', category: 'integrations', route: '/(features)/motion-detection', icon: 'waveform.path' },
  { id: 'rep-counting', title: 'Rep Counting', description: 'Automatic rep detection', phase: 'phase2', category: 'integrations', route: '/(features)/rep-counting', icon: '123.rectangle.fill' },
  { id: 'exercise-recognition', title: 'Exercise Recognition', description: 'Identify movements automatically', phase: 'phase2', category: 'integrations', route: '/(features)/exercise-recognition', icon: 'eye.fill' },

  // Phase 3
  { id: 'nutrition', title: 'Nutrition Recommendations', description: 'Evidence-based nutrition guidance', phase: 'phase3', category: 'nutrition', route: '/(features)/nutrition', icon: 'leaf.fill' },
  { id: 'meal-plans', title: 'Weekly Meal Plans', description: 'AI-generated meal planning', phase: 'phase3', category: 'nutrition', route: '/(features)/meal-plans', icon: 'fork.knife' },
  { id: 'grocery-lists', title: 'Grocery Lists', description: 'Shopping lists from meal plans', phase: 'phase3', category: 'nutrition', route: '/(tabs)/nutrition?section=shopping', icon: 'cart.fill' },
  { id: 'hydration', title: 'Hydration Tracking', description: 'Daily water intake logging', phase: 'phase3', category: 'nutrition', route: '/(features)/hydration', icon: 'drop.fill' },
  { id: 'body-composition', title: 'Body Composition', description: 'Weight, body fat, measurements', phase: 'phase3', category: 'body', route: '/(features)/body-composition', icon: 'figure.stand' },
  { id: 'progress-photos', title: 'Progress Photos', description: 'Track visual progress over time', phase: 'phase3', category: 'body', route: '/(features)/progress-photos', icon: 'camera.fill' },
  { id: 'photo-comparisons', title: 'Before/After Comparisons', description: 'Side-by-side progress views', phase: 'phase3', category: 'body', route: '/(features)/photo-comparisons', icon: 'square.split.2x1.fill' },
  { id: 'physique-projections', title: 'AI Physique Projections', description: 'Visual goal projections', phase: 'phase3', category: 'body', route: '/(features)/physique-projections', icon: 'wand.and.stars' },
  { id: 'goals', title: 'Goal Tracking', description: 'Strength, composition, and habit goals', phase: 'phase3', category: 'analytics', route: '/(features)/goals', icon: 'target' },
  { id: 'analytics-dashboard', title: 'Analytics Dashboard', description: 'Comprehensive fitness analytics', phase: 'phase3', category: 'analytics', route: '/(features)/analytics-dashboard', icon: 'chart.bar.fill' },

  // Phase 4
  { id: 'subscription', title: 'Subscription', description: 'Premium features and billing', phase: 'phase4', category: 'platform', route: '/(features)/subscription', icon: 'creditcard.fill' },
  { id: 'notifications', title: 'Notifications', description: 'Workout reminders and coaching alerts', phase: 'phase4', category: 'platform', route: '/(features)/notifications', icon: 'bell.fill' },
  { id: 'export-share', title: 'Export & Share', description: 'PDF, print, and share fitness data', phase: 'phase4', category: 'platform', route: '/(features)/export-share', icon: 'square.and.arrow.up.fill' },
  { id: 'print-reports', title: 'Print Reports', description: 'Printer-friendly workout and progress reports', phase: 'phase4', category: 'platform', route: '/(features)/print-reports', icon: 'printer.fill' },
];

export const FEATURE_MAP = Object.fromEntries(FEATURES.map((f) => [f.id, f])) as Record<string, FeatureDefinition>;

export const FEATURES_BY_CATEGORY = FEATURES.reduce(
  (acc, f) => {
    (acc[f.category] ??= []).push(f);
    return acc;
  },
  {} as Record<FeatureCategory, FeatureDefinition[]>,
);

export const PHASE_LABELS: Record<FeaturePhase, string> = {
  mvp: 'MVP',
  phase1: 'Phase 1',
  phase2: 'Phase 2',
  phase3: 'Phase 3',
  phase4: 'Phase 4',
};
