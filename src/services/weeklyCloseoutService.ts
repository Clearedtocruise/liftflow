import { apiClient } from '@/api/client';
import type { ServiceResult } from '@/types/common';
import type { WeeklyCloseoutRecord, WeeklyCloseoutSummary } from '@/types/weeklyCloseout';

function ok<T>(data: T): ServiceResult<T> {
  return { success: true, data };
}

function fail(message: string): ServiceResult<never> {
  return { success: false, error: message };
}

export const weeklyCloseoutService = {
  async getSummary(userId: string, weekStart?: string, token?: string): Promise<ServiceResult<WeeklyCloseoutSummary>> {
    try {
      const params = new URLSearchParams({ userId });
      if (weekStart) params.set('weekStart', weekStart);
      const data = await apiClient.get<WeeklyCloseoutSummary>(`/api/weekly/summary?${params}`, token);
      return ok(data);
    } catch (e) {
      return fail(e instanceof Error ? e.message : 'Failed to load weekly summary');
    }
  },

  async getStatus(userId: string, weekStart?: string, token?: string): Promise<ServiceResult<WeeklyCloseoutRecord | null>> {
    try {
      const params = new URLSearchParams({ userId });
      if (weekStart) params.set('weekStart', weekStart);
      const data = await apiClient.get<WeeklyCloseoutRecord | null>(`/api/weekly/closeout/status?${params}`, token);
      return ok(data);
    } catch (e) {
      return fail(e instanceof Error ? e.message : 'Failed to load closeout status');
    }
  },

  async prepare(userId: string, referenceDate?: string, token?: string): Promise<ServiceResult<WeeklyCloseoutRecord>> {
    try {
      const data = await apiClient.post<WeeklyCloseoutRecord>(
        '/api/weekly/closeout/prepare',
        { userId, referenceDate },
        token,
      );
      return ok(data);
    } catch (e) {
      return fail(e instanceof Error ? e.message : 'Failed to prepare weekly closeout');
    }
  },

  async accept(userId: string, closeoutId: string, token?: string): Promise<ServiceResult<WeeklyCloseoutRecord>> {
    try {
      const data = await apiClient.post<WeeklyCloseoutRecord>(
        '/api/weekly/closeout/accept',
        { userId, closeoutId },
        token,
      );
      return ok(data);
    } catch (e) {
      return fail(e instanceof Error ? e.message : 'Failed to accept weekly plan');
    }
  },
};
