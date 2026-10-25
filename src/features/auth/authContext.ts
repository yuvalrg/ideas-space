import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { MessageKey } from '../../lib/i18n';
import type { Profile } from '../../lib/supabase';

/** 'unknown' while the membership check runs (or before sign-in). */
export type Membership = 'unknown' | 'member' | 'notMember';

export interface AuthState {
  /** True until the stored session has been restored on page load. */
  loading: boolean;
  session: Session | null;
  membership: Membership;
  profile: Profile | null;
  /** Error from loading membership/profile, or from a failed magic link (expired, used). */
  error: MessageKey | null;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

/** First entry = the profile was created by the sign-up trigger but not yet confirmed on /welcome. */
export function needsWelcome(profile: Profile | null): boolean {
  return profile !== null && profile.last_seen_at === null;
}
