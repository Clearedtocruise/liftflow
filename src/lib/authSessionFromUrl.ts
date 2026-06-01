import { supabase } from '@/supabase/client';

function parseAuthParamsFromUrl(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');

  let paramString = '';
  if (hashIndex >= 0) {
    paramString = url.slice(hashIndex + 1);
  } else if (queryIndex >= 0) {
    paramString = url.slice(queryIndex + 1);
  }

  for (const part of paramString.split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = decodeURIComponent(part.slice(0, eq));
    const value = decodeURIComponent(part.slice(eq + 1));
    params[key] = value;
  }

  return params;
}

/** Exchange Supabase tokens from an email/deep-link URL into a persisted session. */
export async function createSessionFromUrl(url: string): Promise<{ ok: boolean; error?: string }> {
  const params = parseAuthParamsFromUrl(url);
  const errorDescription = params.error_description ?? params.error;
  if (errorDescription) {
    return { ok: false, error: errorDescription };
  }

  const access_token = params.access_token;
  const refresh_token = params.refresh_token;
  if (!access_token || !refresh_token) {
    return { ok: false, error: 'Missing auth tokens in link.' };
  }

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export function isAuthCallbackUrl(url: string): boolean {
  return (
    url.includes('access_token=') ||
    url.includes('type=recovery') ||
    url.includes('type=signup') ||
    url.includes('/auth/confirm') ||
    url.includes('/auth/reset-password') ||
    url.includes('reset-password')
  );
}
