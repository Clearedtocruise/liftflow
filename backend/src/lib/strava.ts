const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const STRAVA_API = 'https://www.strava.com/api/v3';

export function getStravaConfig() {
  return {
    clientId: process.env.STRAVA_CLIENT_ID ?? '',
    clientSecret: process.env.STRAVA_CLIENT_SECRET ?? '',
    redirectUri: process.env.STRAVA_REDIRECT_URI ?? '',
  };
}

export function isStravaConfigured(): boolean {
  const { clientId, clientSecret, redirectUri } = getStravaConfig();
  return Boolean(clientId && clientSecret && redirectUri);
}

export function buildStravaAuthUrl(state: string, redirectUri: string): string {
  const { clientId } = getStravaConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    approval_prompt: 'auto',
    scope: 'read,activity:read_all',
    state,
  });
  return `${STRAVA_AUTH_URL}?${params.toString()}`;
}

export async function exchangeStravaCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete: { id: number };
}> {
  const { clientId, clientSecret, redirectUri } = getStravaConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  const response = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error('Strava token exchange failed');
  }

  return response.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_at: number;
    athlete: { id: number };
  }>;
}

export async function refreshStravaToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string; expires_at: number }> {
  const { clientId, clientSecret } = getStravaConfig();
  const response = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) throw new Error('Strava token refresh failed');
  return response.json() as Promise<{ access_token: string; refresh_token: string; expires_at: number }>;
}

export type StravaActivityRaw = {
  id: number;
  name: string;
  type: string;
  start_date: string;
  elapsed_time: number;
  distance?: number;
  calories?: number;
  average_speed?: number;
  average_heartrate?: number;
  total_elevation_gain?: number;
};

export async function fetchStravaActivities(accessToken: string, after?: number): Promise<StravaActivityRaw[]> {
  const params = new URLSearchParams({ per_page: '50' });
  if (after) params.set('after', String(after));

  const response = await fetch(`${STRAVA_API}/athlete/activities?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error('Failed to fetch Strava activities');
  return response.json() as Promise<StravaActivityRaw[]>;
}

export function mapStravaToCardio(activity: StravaActivityRaw) {
  const typeMap: Record<string, string> = {
    Run: 'run',
    Walk: 'walk',
    Ride: 'cycle',
    Swim: 'swim',
    Workout: 'hiit',
  };

  const avgPaceSecPerKm =
    activity.distance && activity.distance > 0 ? activity.elapsed_time / (activity.distance / 1000) : undefined;

  return {
    cardio_type: typeMap[activity.type] ?? 'other',
    started_at: activity.start_date,
    ended_at: new Date(new Date(activity.start_date).getTime() + activity.elapsed_time * 1000).toISOString(),
    duration_seconds: activity.elapsed_time,
    distance_meters: activity.distance,
    calories_burned: activity.calories,
    avg_pace_sec_per_km: avgPaceSecPerKm,
    avg_heart_rate: activity.average_heartrate,
    elevation_gain_m: activity.total_elevation_gain,
    notes: activity.name,
    metadata: { source: 'strava', external_id: String(activity.id), activity_type: activity.type },
  };
}
