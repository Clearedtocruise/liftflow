import { apiClient } from '@/api/client';
import { fail, fromError, ok } from '@/lib/serviceResult';
import { withTimeout } from '@/lib/withTimeout';
import { getAccessToken } from '@/supabase/client';
import type { ServiceResult } from '@/types/common';
import type { ExerciseCoachPrescription, ExercisePrescriptionPlanInput } from '@/types/exerciseCoach';

const COACH_PRESCRIPTION_TIMEOUT_MS = 15_000;

export const exerciseCoachService = {
  async getPrescription(
    userId: string,
    exerciseId: string,
    plan?: Omit<ExercisePrescriptionPlanInput, 'exerciseId'>,
  ): Promise<ServiceResult<ExerciseCoachPrescription>> {
    try {
      const token = await getAccessToken();
      const prescription = await withTimeout(
        apiClient.post<ExerciseCoachPrescription>(
          '/api/training/coaching/exercise-prescription',
          { userId, exerciseId, plan },
          token,
        ),
        COACH_PRESCRIPTION_TIMEOUT_MS,
        'exercise coach prescription',
      );
      return ok(prescription);
    } catch (e) {
      return fromError(e);
    }
  },

  async getWorkoutPrescriptions(
    userId: string,
    exercises: ExercisePrescriptionPlanInput[],
  ): Promise<ServiceResult<ExerciseCoachPrescription[]>> {
    try {
      const token = await getAccessToken();
      const prescriptions = await withTimeout(
        apiClient.post<ExerciseCoachPrescription[]>(
          '/api/training/coaching/workout-prescriptions',
          { userId, exercises },
          token,
        ),
        COACH_PRESCRIPTION_TIMEOUT_MS,
        'workout coach prescriptions',
      );
      return ok(prescriptions);
    } catch (e) {
      return fromError(e);
    }
  },

  fromError,
  fail,
};
