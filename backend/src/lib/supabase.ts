import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export const supabaseAdmin =
  url && key ? createClient(url, key) : null;

export function requireAdmin() {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required on backend');
  }
  return supabaseAdmin;
}
