import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { API_BASE_URL } from '@/constants/api';
import { getAccessToken } from '@/supabase/client';

import type { StravaActivity } from './types';

WebBrowser.maybeCompleteAuthSession();

const STRAVA_CALLBACK_SCHEME = 'liftflow://strava/callback';

export async function startStravaOAuth(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const token = await getAccessToken();
    if (!token) return { success: false, error: 'Sign in required' };

    const redirectUri = Linking.createURL('strava/callback');
    const authUrl = `${API_BASE_URL}/api/integrations/strava/authorize?userId=${encodeURIComponent(userId)}&redirect_uri=${encodeURIComponent(redirectUri)}`;

    const result = await WebBrowser.openAuthSessionAsync(authUrl, STRAVA_CALLBACK_SCHEME);
    if (result.type === 'success') {
      return { success: true };
    }
    if (result.type === 'cancel') {
      return { success: false, error: 'Strava authorization cancelled' };
    }
    return { success: false, error: 'Strava authorization failed' };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Strava OAuth failed' };
  }
}

export async function fetchStravaActivities(userId: string): Promise<StravaActivity[]> {
  const token = await getAccessToken();
  const response = await fetch(`${API_BASE_URL}/api/integrations/strava/activities?userId=${encodeURIComponent(userId)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new Error('Failed to fetch Strava activities');
  }
  const data = (await response.json()) as { activities: StravaActivity[] };
  return data.activities ?? [];
}

export async function disconnectStrava(userId: string): Promise<void> {
  const token = await getAccessToken();
  await fetch(`${API_BASE_URL}/api/integrations/strava/disconnect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ userId }),
  });
}
