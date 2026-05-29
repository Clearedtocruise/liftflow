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

  // Nutrition
  generateMealPlan: (userId: string, token?: string) =>
    apiClient.post<import('@/types').MealPlan>('/api/nutrition/meal-plan/generate', { userId }, token),

  // Integrations
  syncHealthKit: (token?: string) =>
    apiClient.post<{ synced: number }>('/api/integrations/healthkit/sync', {}, token),
} as const;
