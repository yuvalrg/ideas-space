import { t, type MessageKey } from '../lib/i18n';

/** Placeholder for a screen that a later PLAN.md step builds. */
export function ComingSoonRoute({ titleKey, step }: { titleKey: MessageKey; step: number }) {
  return (
    <section>
      <h1 className="text-2xl font-bold text-slate-900">{t(titleKey)}</h1>
      <p className="mt-3 text-slate-600">{t('comingSoon.text', { step })}</p>
    </section>
  );
}
