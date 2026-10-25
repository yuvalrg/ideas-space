import { t } from '../lib/i18n';
import { useAuth } from '../features/auth/authContext';

/** Home screen placeholder. The idea list is built in step 3. */
export function HomeRoute() {
  const { profile } = useAuth();
  return (
    <section>
      <h1 className="text-2xl font-bold text-slate-900">
        {t('home.greeting', { name: profile?.display_name ?? '' })}
      </h1>
      <p className="mt-3 text-slate-600">{t('home.intro')}</p>
    </section>
  );
}
