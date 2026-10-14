import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { fail, fromError, ok } from '@/lib/serviceResult';
import { buildWorkoutHistoryHtml, type WorkoutHistoryReportOptions } from '@/lib/workoutHistoryReport';
import { workoutService } from '@/services/workoutService';
import type { ServiceResult } from '@/types/common';

function fileStamp(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Builds a PDF of every completed workout and opens the share sheet so it can be saved to Files,
 * AirDropped or mailed. Returns how many sessions went into it.
 */
export async function exportWorkoutHistoryPdf(
  userId: string,
  options: Omit<WorkoutHistoryReportOptions, 'generatedAt'>,
): Promise<ServiceResult<{ sessionCount: number }>> {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      return fail('Sharing is not available on this device.');
    }

    const sessions = await workoutService.getAllCompletedSessions(userId);
    if (!sessions.success) return fail(sessions.error);
    if (sessions.data.length === 0) return fail('There are no completed workouts to export yet.');

    const generatedAt = new Date();
    const html = buildWorkoutHistoryHtml(sessions.data, { ...options, generatedAt });
    const printed = await Print.printToFileAsync({ html });

    // The print API names the file with a random id, which is what the lifter would then see in
    // Files. Give it a name that says what it is; if the rename fails the original still shares.
    let uri = printed.uri;
    try {
      const target = new File(Paths.cache, `LiftFlow-Workout-History-${fileStamp(generatedAt)}.pdf`);
      if (target.exists) target.delete();
      new File(printed.uri).move(target);
      uri = target.uri;
    } catch {
      uri = printed.uri;
    }

    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: 'Workout history',
    });

    return ok({ sessionCount: sessions.data.length });
  } catch (e) {
    return fromError(e);
  }
}
