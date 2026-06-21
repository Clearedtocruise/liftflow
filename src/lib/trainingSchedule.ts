import type { UserProfile } from '@/types';

const VALID_DAYS = new Set([3, 4, 5, 6, 7]);

export function resolveDaysPerWeek(user?: UserProfile | null, programFrequency?: number): number {
  const coachDays = user?.metadata?.coachProfile?.daysPerWeek;
  if (coachDays != null && VALID_DAYS.has(coachDays)) return coachDays;

  const activationDays = user?.metadata?.coachActivation?.frequency;
  if (typeof activationDays === 'number' && VALID_DAYS.has(activationDays)) return activationDays;

  if (programFrequency != null && VALID_DAYS.has(programFrequency)) return programFrequency;

  return 4;
}

export function summarizeTrainingSchedule(daysPerWeek: number): string {
  const restDays = Math.max(0, 7 - daysPerWeek);
  if (restDays === 0) return `${daysPerWeek} lift days · every day`;
  if (restDays === 1) return `${daysPerWeek} lift days · 1 rest day`;
  return `${daysPerWeek} lift days · ${restDays} rest days`;
}

export function trainingScheduleLabel(daysPerWeek: number): string {
  if (daysPerWeek === 7) return '7 days (every day)';
  return `${daysPerWeek} days per week`;
}
