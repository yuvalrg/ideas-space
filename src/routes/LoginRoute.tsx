import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import { t, type MessageKey } from '../lib/i18n';
import { Message } from '../lib/i18n/Message';
import { errorMessageKey, getSupabase } from '../lib/supabase';
import { CenteredCard } from '../components/CenteredCard';
import { useAuth } from '../features/auth/authContext';

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Magic-link login (spec section 5). The email is checked against the allowed list first;
 * an email not on the list gets the "not in the group" message and no link is sent.
 */
export function LoginRoute() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);

  if (auth.session && auth.membership === 'member') return <Navigate to="/" replace />;

  const shownError = error ?? auth.error;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    auth.clearError();
    const normalized = email.trim().toLowerCase();
    if (!normalized) return setError('login.emailRequired');
    if (!EMAIL_PATTERN.test(normalized)) return setError('login.emailInvalid');

    setSending(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const allowed = await supabase.rpc('check_email_allowed', { p_email: normalized });
      if (allowed.error) throw allowed.error;
      if (!allowed.data) {
        setError('login.notAllowed');
        return;
      }
      const sent = await supabase.auth.signInWithOtp({
        email: normalized,
        options: { emailRedirectTo: `${window.location.origin}/`, shouldCreateUser: true },
      });
      if (sent.error) throw sent.error;
      setSentTo(normalized);
    } catch (cause) {
      // The typed email stays in the field (hard rule 6).
      setError(errorMessageKey(cause));
    } finally {
      setSending(false);
    }
  }

  if (sentTo) {
    return (
      <CenteredCard title={t('login.sentTitle')}>
        <p role="status" className="text-slate-700">
          <Message
            id="login.sent"
            values={{
              email: (
                <span dir="ltr" className="font-medium">
                  {sentTo}
                </span>
              ),
            }}
          />
        </p>
        <p className="mt-2 text-sm text-slate-500">{t('login.sentHint')}</p>
        <button type="button" onClick={() => setSentTo(null)} className="btn-secondary mt-6">
          {t('login.useOtherEmail')}
        </button>
      </CenteredCard>
    );
  }

  return (
    <CenteredCard title={t('login.title')}>
      <p className="text-slate-600">{t('login.subtitle')}</p>
      <form onSubmit={onSubmit} noValidate className="mt-6">
        <label htmlFor="login-email" className="block text-sm font-medium text-slate-700">
          {t('login.emailLabel')}
        </label>
        <input
          id="login-email"
          type="email"
          dir="ltr"
          inputMode="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={shownError ? true : undefined}
          aria-describedby={shownError ? 'login-error' : undefined}
          className="field-input mt-1"
        />
        {shownError && (
          <p id="login-error" role="alert" className="mt-2 text-sm font-medium text-red-700">
            {t(shownError)}
          </p>
        )}
        <button type="submit" disabled={sending} className="btn-primary mt-6 w-full">
          {sending ? t('login.sending') : t('login.submit')}
        </button>
      </form>
    </CenteredCard>
  );
}
