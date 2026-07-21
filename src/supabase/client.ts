import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

import { recordEgress } from '@/lib/egressGuard';
import { authStorage } from '@/supabase/authStorage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured =
  Boolean(supabaseUrl && supabaseAnonKey) &&
  !supabaseUrl.includes('placeholder');

function requireConfig(): { url: string; key: string } {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env',
    );
  }
  return { url: supabaseUrl, key: supabaseAnonKey };
}

const config = isSupabaseConfigured ? requireConfig() : { url: supabaseUrl, key: supabaseAnonKey };

function instrumentedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  let path = url;
  try {
    const parsed = new URL(url);
    // Strip query values to keep telemetry keys stable (keep table/rpc path only).
    path = parsed.pathname;
  } catch {
    // keep raw url
  }

  const method = (init?.method ?? 'GET').toUpperCase();
  const started = Date.now();

  return fetch(input, init).then((response) => {
    // Prefer Content-Length; never clone the body (that would double local work/egress).
    const bytesEstimate = Number(response.headers.get('content-length') ?? 0);
    recordEgress(`supabase:${method}:${path}`, {
      bytesEstimate,
      meta: { status: response.status, ms: Date.now() - started },
    });
    return response;
  });
}

export const supabase = createClient(config.url, config.key, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: instrumentedFetch,
  },
});

export async function getAccessToken(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}
