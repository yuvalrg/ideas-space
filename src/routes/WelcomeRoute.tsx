import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import { t, type MessageKey } from '../lib/i18n';
import { Message } from '../lib/i18n/Message';
import { errorMessageKey, getSupabase } from '../lib/supabase';
import { CenteredCard } from '../components/CenteredCard';
import { needsWelcome, useAuth } from '../features/auth/authContext';
import { invalidateLookups } from '../features/ideas/useLookups';

/**
 * First entry (spec section 5): the sign-up trigger created the profile with a name taken from the
 * email; here the partner confirms or changes it. Saving also stamps last_seen_at, which ends the
 * first-entry state. The picture is optional and is added later in settings.
 */
export function WelcomeRoute() {
  const { session, profile, reload } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);

  if (!profile || !session) return null;
  if (!needsWelcome(profile)) return <Navigate to="/" replace />;
  const userId = session.user.id;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError('welcome.nameRequired');

    setSaving(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const updated = await supabase
        .from('profiles')
        .update({ display_name: trimmed })
        .eq('id', userId)
        .select('id');
      if (updated.error) throw updated.error;
      if (updated.data.length !== 1) throw new Error('profile_not_updated');
      const touched = await supabase.rpc('touch_last_seen');
      if (touched.error) throw touched.error;
      invalidateLookups(); // partner names changed
      await reload(); // profile.last_seen_at is now set; the guard lets the partner in
    } catch (cause) {
      // The typed name stays in the field (hard rule 6).
      setError(errorMessageKey(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <CenteredCard title={t('welcome.title')}>
      <p className="text-slate-600">{t('welcome.intro')}</p>
      <form onSubmit={onSubmit} noValidate className="mt-6">
        <label htmlFor="welcome-name" className="block text-sm font-medium text-slate-700">
          {t('welcome.nameLabel')}
        </label>
        <input
          id="welcome-name"
          type="text"
          autoComplete="name"
          autoFocus
          maxLength={60}
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'welcome-error' : 'welcome-email'}
          className="field-input mt-1"
        />
        <p id="welcome-email" className="mt-2 text-sm text-slate-500">
          <Message
            id="welcome.emailNote"
            values={{ email: <span dir="ltr">{session.user.email}</span> }}
          />
        </p>
        {error && (
          <p id="welcome-error" role="alert" className="mt-2 text-sm font-medium text-red-700">
            {t(error)}
          </p>
        )}
        <button type="submit" disabled={saving} className="btn-primary mt-6 w-full">
          {saving ? t('welcome.saving') : t('welcome.save')}
        </button>
      </form>
    </CenteredCard>
  );
}
