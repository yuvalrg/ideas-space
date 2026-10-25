import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { t, type MessageKey } from '../lib/i18n';
import { errorMessageKey } from '../lib/supabase';
import { TimeAgo } from '../components/TimeAgo';
import { describe, detail, listActivity, type ActivityRow } from '../features/activity/api';
import { partnerName, useLookups } from '../features/ideas/useLookups';

/** Recent activity (spec section 6): the group's last 50 actions, newest first, with the idea. */
export function ActivityRoute() {
  const lookups = useLookups();
  const [rows, setRows] = useState<ActivityRow[] | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    listActivity().then(
      (list) => {
        if (!cancelled) setRows(list);
      },
      (cause: unknown) => {
        if (!cancelled) setError(errorMessageKey(cause));
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section>
      <h1 className="text-2xl font-bold text-slate-900">{t('activity.title')}</h1>
      <p className="mt-2 text-slate-600">{t('activity.intro')}</p>

      {error && (
        <p role="alert" className="mt-4 font-medium text-red-700">
          {t(error)}
        </p>
      )}
      {!rows ? (
        !error && (
          <p role="status" className="mt-6 text-slate-500">
            {t('common.loading')}
          </p>
        )
      ) : rows.length === 0 ? (
        <p className="mt-6 text-slate-600">{t('activity.empty')}</p>
      ) : (
        <ol className="card mt-6 divide-y divide-slate-100 p-0">
          {rows.map(({ activity, idea }) => {
            const extra = detail(activity);
            return (
              <li
                key={activity.id}
                className="flex flex-wrap items-start gap-x-4 gap-y-1 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-slate-900">
                    <bdi className="font-medium">{partnerName(lookups, activity.actor_id)}</bdi>
                    {' · '}
                    {describe(activity)}
                    {idea && (
                      <>
                        {' · '}
                        {idea.trashed ? (
                          <span className="text-slate-500">
                            <bdi>{idea.title}</bdi> {t('activity.trashedIdea')}
                          </span>
                        ) : (
                          <Link to={`/ideas/${idea.id}`} className="text-blue-700 hover:underline">
                            <bdi>{idea.title}</bdi>
                          </Link>
                        )}
                      </>
                    )}
                  </p>
                  {extra && (
                    <p
                      className="mt-1 line-clamp-2 text-sm text-slate-600"
                      dir={extra.ltr ? 'ltr' : undefined}
                      data-user-content={extra.ltr ? undefined : true}
                    >
                      {extra.text}
                    </p>
                  )}
                </div>
                <span className="text-sm whitespace-nowrap text-slate-500">
                  <TimeAgo iso={activity.created_at} />
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
