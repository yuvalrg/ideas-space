import { Navigate, Outlet, useLocation } from 'react-router';
import { t } from '../../lib/i18n';
import { Message } from '../../lib/i18n/Message';
import { CenteredCard, FullPageMessage } from '../../components/CenteredCard';
import { needsWelcome, useAuth } from './authContext';

/** Guards every route except /login: requires a session, a joined membership and a confirmed profile. */
export function RequireAuth() {
  const { loading, session, membership, profile, error, reload, signOut } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageMessage text={t('common.loading')} />;
  if (!session) return <Navigate to="/login" replace />;

  if (error && membership === 'unknown') {
    return (
      <CenteredCard title={t('app.name')}>
        <p role="alert" className="text-red-700">
          {t(error)}
        </p>
        <button type="button" onClick={() => void reload()} className="btn-primary mt-6">
          {t('common.retry')}
        </button>
      </CenteredCard>
    );
  }

  if (membership === 'unknown') return <FullPageMessage text={t('common.loading')} />;

  if (membership === 'notMember') {
    return (
      <CenteredCard title={t('access.title')}>
        <p className="text-slate-700">
          <Message
            id="access.text"
            values={{
              email: (
                <span dir="ltr" className="font-medium">
                  {session.user.email}
                </span>
              ),
            }}
          />
        </p>
        <button type="button" onClick={() => void signOut()} className="btn-secondary mt-6">
          {t('nav.signOut')}
        </button>
      </CenteredCard>
    );
  }

  if (needsWelcome(profile) && location.pathname !== '/welcome') {
    return <Navigate to="/welcome" replace />;
  }

  return <Outlet />;
}
