/**
 * Centralized API client for LiftFlow backend.
 * All server-side AI, parsing, analytics, and export operations route through here.
 */

import { API_BASE_URL } from '@/constants/api';

const API_BASE = API_BASE_URL;

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string;
};

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, token } = options;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message ?? `API error ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  get<T>(path: string, token?: string) {
    return this.request<T>(path, { token });
  }

  post<T>(path: string, body: unknown, token?: string) {
    return this.request<T>(path, { method: 'POST', body, token });
  }

  put<T>(path: string, body: unknown, token?: string) {
    return this.request<T>(path, { method: 'PUT', body, token });
  }

  delete<T>(path: string, token?: string) {
    return this.request<T>(path, { method: 'DELETE', token });
  }
}

export const apiClient = new ApiClient(API_BASE);

/** Typed API endpoints — mirrors backend/src/routes/ */
export const api = {
  health: () => apiClient.get<{ status: string }>('/health'),

  // Voice & AI
  parseVoice: (body: import('@/types').ParseVoiceRequest, token?: string) =>
    apiClient.post<import('@/types').ParseVoiceResponse>('/api/voice/parse', body, token),
  askCoach: (body: import('@/types').CoachingRequest & { userId: string }, token?: string) =>
    apiClient.post<import('@/types').AICoachingSession>('/api/ai/coach', body, token),
  getRecommendations: (userId: string, token?: string) =>
    apiClient.get<import('@/types').AIRecommendation[]>(`/api/ai/recommendations?userId=${userId}`, token),
  suggestProgression: (exerciseId: string, token?: string) =>
    apiClient.get<import('@/types').ProgressionSuggestion>(`/api/ai/progression/${exerciseId}`, token),

  // Analytics
  getDashboard: (token?: string) =>
    apiClient.get<import('@/types').DashboardSummary>('/api/analytics/dashboard', token),
  generateSnapshot: (date: string, token?: string) =>
    apiClient.post<import('@/types').AnalyticsSnapshot>('/api/analytics/snapshots', { date }, token),

  // Export
  exportDocument: (body: import('@/types').ExportRequest & { userId: string }, token?: string) =>
    apiClient.post<import('@/types').ExportedDocument>('/api/export', body, token),
  createShareLink: (body: import('@/types').ShareRequest, token?: string) =>
    apiClient.post<import('@/types').ShareLink>('/api/export/share', body, token),
  generatePdf: (body: import('@/types').ExportRequest & { userId: string }, token?: string) =>
    apiClient.post<import('@/types').ExportedDocument>('/api/export/pdf', body, token),

  // Training
  suggestMuscleGroups: (userId: string, token?: string) =>
    apiClient.get<import('@/types').SuggestedMuscleGroups>(`/api/training/suggest-muscles?userId=${userId}`, token),
  assessRecovery: (userId: string, token?: string) =>
    apiClient.get<import('@/types').RecoveryAssessment>(`/api/training/recovery?userId=${userId}`, token),
  submitRecoveryCheckIn: (
    body: {
      userId: string;
      sleepHours?: number;
      sleepQuality?: number;
      energyLevel?: number;
      stressLevel?: number;
      sorenessLevel?: number;
    },
    token?: string,
  ) => apiClient.post<import('@/types/coaching').DailyRecoveryCheckIn>('/api/training/recovery/check-in', body, token),
  getRecoveryToday: (userId: string, token?: string) =>
    apiClient.get<Record<string, unknown> | null>(`/api/training/recovery/today?userId=${userId}`, token),
  getRecoveryTrend: (userId: string, token?: string) =>
    apiClient.get<import('@/types/coaching').RecoveryTrendPoint[]>(`/api/training/recovery/trend?userId=${userId}`, token),
  submitWeeklyCheckIn: (
    body: {
      userId: string;
      weightKg?: number;
      waistCm?: number;
      compliancePct?: number;
      energyScore?: number;
      sleepScore?: number;
    },
    token?: string,
  ) => apiClient.post<import('@/types/coaching').WeeklyCoachCheckIn>('/api/training/weekly-check-in', body, token),
  getWeeklyCheckInTrend: (userId: string, token?: string) =>
    apiClient.get<import('@/types/coaching').WeeklyCoachCheckIn[]>(
      `/api/training/weekly-check-in/trend?userId=${userId}`,
      token,
    ),
  getLimitations: (userId: string, token?: string) =>
    apiClient.get<import('@/types/coaching').TrainingLimitation[]>(
      `/api/training/limitations?userId=${userId}`,
      token,
    ),
  createLimitation: (body: Record<string, unknown>, token?: string) =>
    apiClient.post<import('@/types/coaching').TrainingLimitation>('/api/training/limitations', body, token),
  getAdaptiveMacroTargets: (userId: string, token?: string) =>
    apiClient.post<import('@/types/coaching').AdaptiveMacroTargets>(
      '/api/nutrition/adaptive-targets',
      { userId },
      token,
    ),
  generateDailyMealPlan: (
    body: { userId: string; date?: string; dietaryStyle?: string },
    token?: string,
  ) => apiClient.post<import('@/types/coaching').DailyMealPlan>('/api/nutrition/daily-plan', body, token),

  generateProgram: (body: import('@/types').CreateProgramPayload & { userId: string }, token?: string) =>
    apiClient.post<{ program: Record<string, unknown>; plannedCount: number }>(
      '/api/training/programs/generate',
      body,
      token,
    ),
  getProgramDashboard: (userId: string, token?: string) =>
    apiClient.get<Record<string, unknown> | null>(`/api/training/programs/dashboard?userId=${userId}`, token),
  adaptProgram: (userId: string, token?: string) =>
    apiClient.post<{ adapted: boolean; changes: string[] }>('/api/training/programs/adapt', { userId }, token),
  getPlannedWorkoutsRange: (userId: string, from: string, to: string, token?: string) =>
    apiClient.get<Record<string, unknown>[]>(
      `/api/training/programs/planned?userId=${userId}&from=${from}&to=${to}`,
      token,
    ),
  reschedulePlannedWorkout: (id: string, scheduledDate: string, token?: string) =>
    apiClient.request<Record<string, unknown>>(`/api/training/programs/planned/${id}/reschedule`, {
      method: 'PATCH',
      body: { scheduledDate },
      token,
    }),

  // Nutrition
  generateMealPlan: (userId: string, token?: string) =>
    apiClient.post<import('@/types').MealPlan>('/api/nutrition/meal-plan/generate', { userId }, token),

  // Integrations
  syncHealthKit: (token?: string) =>
    apiClient.post<{ synced: number }>('/api/integrations/healthkit/sync', {}, token),

  // Apple Watch workout assistant
  watchSupportedExercises: () => apiClient.get<{ exercises: string[] }>('/api/watch/supported-exercises'),
  watchProcessMotion: (
    body: {
      exerciseName: string;
      samples: { recordedAt: number; accelerometer: { x: number; y: number; z: number }; gyroscope?: { x: number; y: number; z: number } }[];
    },
    token?: string,
  ) => apiClient.post<{ detectedReps: number; confidence: number; needsConfirmation: boolean; spokenPrompt?: string }>(
    '/api/watch/motion',
    body,
    token,
  ),
  watchVoiceCommand: (
    body: {
      transcript: string;
      exerciseId?: string;
      exerciseName?: string;
      currentRep?: number;
      targetReps?: number;
      targetSets?: number;
      setNumber?: number;
    },
    token?: string,
  ) => apiClient.post<{ spokenResponse: string; repCount?: number }>('/api/watch/voice', body, token),
} as const;
