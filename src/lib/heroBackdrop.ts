/**
 * Picks the dashboard hero backdrop from the clock as well as the session type.
 *
 * A night landscape behind "Good Morning" reads as a bug, so daylight hours get a day scene and
 * evening hours get the night one. Kept pure and hour-driven so it can be tested without mocking a
 * clock, and so the caller decides when to re-evaluate.
 */

import { HeroImages } from '@/constants/imagery';

export type HeroBackdropKind = 'workout' | 'recovery';

/** Local hours treated as daylight. Dusk lands at 18:00 to match the "Good Evening" greeting. */
export const DAY_START_HOUR = 6;
export const DAY_END_HOUR = 18;

export function isDaytimeHour(hour: number): boolean {
  return hour >= DAY_START_HOUR && hour < DAY_END_HOUR;
}

export function resolveHeroBackdrop(kind: HeroBackdropKind, hour: number): string {
  const daytime = isDaytimeHour(hour);
  if (kind === 'recovery') {
    return daytime ? HeroImages.dashboard.hero.recoveryDay : HeroImages.dashboard.hero.recoveryNight;
  }
  return daytime ? HeroImages.dashboard.hero.workoutDay : HeroImages.dashboard.hero.workoutNight;
}
