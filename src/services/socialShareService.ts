import { Share } from 'react-native';

import { fail, fromError, ok } from '@/lib/serviceResult';
import type { WorkoutHistoryItem, WorkoutSession } from '@/types';

function formatRecap(session: WorkoutSession | WorkoutHistoryItem): string {
  const name = session.name;
  const duration =
    'durationMinutes' in session
      ? session.durationMinutes
      : session.durationSeconds
        ? Math.round(session.durationSeconds / 60)
        : 0;
  const sets = session.totalSets ?? 0;
  const volume = session.totalVolume ?? 0;
  const prCount = 'prCount' in session ? session.prCount : countPrs(session);

  const lines = [
    `💪 ${name}`,
    `⏱ ${duration} min · ${sets} sets · ${(volume / 1000).toFixed(1)}k volume`,
  ];

  if (prCount && prCount > 0) {
    lines.push(`🏆 ${prCount} new PR${prCount > 1 ? 's' : ''}!`);
  }

  lines.push('', 'Tracked with ONE MORE');

  return lines.join('\n');
}

function countPrs(session: WorkoutSession | WorkoutHistoryItem): number {
  if ('prCount' in session && session.prCount) return session.prCount;
  if (!('exercises' in session)) return 0;
  return session.exercises.reduce(
    (count, exercise) => count + exercise.sets.filter((set) => set.isPr).length,
    0,
  );
}

export const socialShareService = {
  async shareWorkoutRecap(session: WorkoutSession | WorkoutHistoryItem) {
    try {
      const message = formatRecap(session);
      const result = await Share.share(
        {
          message,
          title: `${session.name} — ONE MORE`,
        },
        {
          dialogTitle: 'Share workout',
          subject: `${session.name} workout recap`,
        },
      );

      if (result.action === Share.dismissedAction) {
        return ok({ shared: false });
      }

      return ok({ shared: true, activityType: result.activityType });
    } catch (e) {
      return fromError(e);
    }
  },

  async shareToSocial(session: WorkoutSession | WorkoutHistoryItem, platform?: 'instagram' | 'x' | 'facebook') {
    const recap = formatRecap(session);

    if (platform === 'instagram') {
      return fail('Open Instagram and paste your recap — direct posting requires the Instagram app.');
    }

    return this.shareWorkoutRecap(session);
  },

  formatRecap,
};
