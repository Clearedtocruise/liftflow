import { apiClient } from '@/api/client';
import { fail, fromError, ok } from '@/lib/serviceResult';
import { getAccessToken } from '@/supabase/client';
import type { ExerciseCoachPrescription, ExercisePrescriptionPlanInput } from '@/types/exerciseCoach';
import type { ServiceResult } from '@/types/common';

export const exerciseCoachService = {
  async getPrescription(
    userId: string,
    exerciseId: string,
    plan?: Omit<ExercisePrescriptionPlanInput, 'exerciseId'>,
  ): Promise<ServiceResult<ExerciseCoachPrescription>> {
    try {
      const token = await getAccessToken();
      const prescription = await apiClient.post<ExerciseCoachPrescription>(
        '/api/training/coaching/exercise-prescription',
        { userId, exerciseId, plan },
        token,
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
      const prescriptions = await apiClient.post<ExerciseCoachPrescription[]>(
        '/api/training/coaching/workout-prescriptions',
        { userId, exercises },
        token,
      );
      return ok(prescriptions);
    } catch (e) {
      return fromError(e);
    }
  },

  fromError,
  fail,
};
