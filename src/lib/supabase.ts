import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

/** True when .env.local provides the Supabase URL and anon key. */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * Lazily creates the browser client. Created on first use (not at import) so the app shell
 * still renders when env vars are missing. Only the anon key is ever used in the browser.
 */
export function getSupabase(): SupabaseClient {
  if (!client) {
    if (!url || !anonKey) {
      throw new Error('missing_supabase_env');
    }
    client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}
