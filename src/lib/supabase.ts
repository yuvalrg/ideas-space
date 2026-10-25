import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { isMessageKey, type MessageKey } from './i18n';

export type Db = SupabaseClient<Database>;
export type Profile = Database['public']['Tables']['profiles']['Row'];

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client: Db | null = null;

/** True when .env.local provides the Supabase URL and anon key. */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * Lazily creates the browser client. Created on first use (not at import) so the app shell
 * still renders when env vars are missing. Only the anon key is ever used in the browser.
 */
export function getSupabase(): Db {
  if (!client) {
    if (!url || !anonKey) {
      throw new Error('missing_supabase_env');
    }
    client = createClient<Database>(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Implicit flow: the magic link also works when opened on another device (e.g. the phone's
        // mail app), where a PKCE code verifier from this browser would be missing.
        flowType: 'implicit',
      },
    });
  }
  return client;
}

/**
 * Maps a Supabase / Postgres / network error to a he.json key. Database functions raise short
 * codes (e.g. 'not_a_member'); those with an `errors.<code>` entry get their own message.
 */
export function errorMessageKey(error: unknown): MessageKey {
  if (error instanceof TypeError) return 'errors.network'; // fetch failed
  if (error && typeof error === 'object') {
    const { code, message, status } = error as { code?: string; message?: string; status?: number };
    if (code === 'over_email_send_rate_limit' || status === 429) return 'errors.rateLimit';
    if (code === 'otp_expired') return 'errors.linkExpired';
    // Supabase's built-in sender delivers only to the project's team members (until SMTP is set).
    if (code === 'email_address_not_authorized') return 'errors.emailNotAuthorized';
    const key = `errors.${message ?? ''}`;
    if (isMessageKey(key)) return key;
    if (message?.includes('Failed to fetch')) return 'errors.network';
  }
  return 'errors.generic';
}
