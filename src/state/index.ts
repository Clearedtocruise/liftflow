/**
 * Application state layer exports.
 *
 * Architecture:
 * - Contexts: scoped reactive state (auth, active workout session)
 * - Services: data fetching and mutations (see src/services/)
 * - Types: domain models (see src/types/)
 *
 * Future state modules (scaffolded, not yet implemented):
 * - nutritionStore: meal plans, hydration, grocery lists
 * - analyticsStore: dashboard metrics, trends, snapshots
 * - integrationStore: HealthKit, Watch, motion data
 * - notificationStore: push notifications, reminders
 * - subscriptionStore: tier, billing status
 */

export { AppProviders } from './AppProviders';
export { WorkoutSessionProvider, useWorkoutSession } from './workout/WorkoutSessionContext';

