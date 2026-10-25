import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { MessageKey } from '../../lib/i18n';
import { errorMessageKey, getSupabase, type Profile } from '../../lib/supabase';
import { AuthContext, type AuthState, type Membership } from './authContext';

/**
 * A magic link that failed (expired or already used) redirects back with the error in the URL
 * hash. Read it once on load and remove it from the address bar.
 */
let redirectError: MessageKey | null | undefined;

function takeRedirectError(): MessageKey | null {
  // Read once per page load: StrictMode runs state initializers twice, and the first run clears it.
  if (redirectError !== undefined) return redirectError;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const code = params.get('error_code') ?? params.get('error');
  redirectError = code ? errorMessageKey({ code }) : null;
  if (code) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  return redirectError;
}

interface Loaded {
  userId: string;
  membership: Exclude<Membership, 'unknown'>;
  profile: Profile | null;
}

/** is_member() first: a removed partner gets 'notMember' and no profile read. */
async function loadMembership(userId: string): Promise<Loaded> {
  const supabase = getSupabase();
  const member = await supabase.rpc('is_member');
  if (member.error) throw member.error;
  if (!member.data) return { userId, membership: 'notMember', profile: null };
  const result = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (result.error) throw result.error;
  return { userId, membership: 'member', profile: result.data };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [redirectError] = useState(takeRedirectError);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<MessageKey | null>(redirectError);

  // Restore the stored session and follow sign-in / sign-out / token refresh.
  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      // No Supabase calls inside this callback (they can deadlock); only update state.
      setSession(next);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  // Check membership and load the profile whenever the signed-in user changes.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadMembership(userId).then(
      (result) => {
        if (!cancelled) setLoaded(result);
      },
      (cause: unknown) => {
        if (!cancelled) setError(errorMessageKey(cause));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Results for a previous user (or none yet) count as unknown.
  const current = loaded && loaded.userId === userId ? loaded : null;
  const membership: Membership = current?.membership ?? 'unknown';
  const profile = current?.profile ?? null;

  const reload = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      setLoaded(await loadMembership(userId));
    } catch (cause) {
      setError(errorMessageKey(cause));
    }
  }, [userId]);

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut();
    setLoaded(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<AuthState>(
    () => ({ loading, session, membership, profile, error, reload, signOut, clearError }),
    [loading, session, membership, profile, error, reload, signOut, clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
