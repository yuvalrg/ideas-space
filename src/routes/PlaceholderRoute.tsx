import { t } from '../lib/i18n';

/** Step 0 placeholder screen. Replaced by real routing in step 2. */
export function PlaceholderRoute() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-800">
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-start">{t('app.name')}</h1>
        <p className="mt-3 text-lg text-slate-600">{t('app.tagline')}</p>
        <p className="mt-6 border-s-4 border-blue-600 ps-4 text-slate-700">
          {t('app.placeholder')}
        </p>
      </div>
    </main>
  );
}
