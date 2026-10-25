import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { t, type MessageKey } from '../lib/i18n';
import { Message } from '../lib/i18n/Message';
import { errorMessageKey } from '../lib/supabase';
import { TimeAgo } from '../components/TimeAgo';
import { STATUS_LABEL, type Idea } from '../features/ideas/api';
import { partnerName, useLookups } from '../features/ideas/useLookups';
import { listTrash, restoreIdea } from '../features/trash/api';

/** Trash (spec section 6): name, who moved it, when, status before; restore only in phase 1. */
export function TrashRoute() {
  const lookups = useLookups();
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const [notice, setNotice] = useState<{ id: string; title: string } | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listTrash().then(
      (list) => {
        if (!cancelled) setIdeas(list);
      },
      (cause: unknown) => {
        if (!cancelled) setError(errorMessageKey(cause));
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  async function restore(idea: Idea) {
    setRestoringId(idea.id);
    setError(null);
    try {
      await restoreIdea(idea.id);
      setIdeas((list) => list?.filter((i) => i.id !== idea.id) ?? null);
      setNotice({ id: idea.id, title: idea.title });
    } catch (cause) {
      setError(errorMessageKey(cause));
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <section>
      <h1 className="text-2xl font-bold text-slate-900">{t('trash.title')}</h1>
      <p className="mt-2 text-slate-600">{t('trash.intro')}</p>

      {notice && (
        <p role="status" className="mt-4 text-sm font-medium text-emerald-700">
          {t('trash.restored', { title: notice.title })}{' '}
          <Link to={`/ideas/${notice.id}`} className="underline">
            {t('trash.open')}
          </Link>
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm font-medium text-red-700">
          {t(error)}
        </p>
      )}

      {!ideas ? (
        !error && (
          <p role="status" className="mt-6 text-slate-500">
            {t('common.loading')}
          </p>
        )
      ) : ideas.length === 0 ? (
        <p className="mt-6 text-slate-600">{t('trash.empty')}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {ideas.map((idea) => (
            <li key={idea.id} className="card flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-slate-900" data-user-content>
                  {idea.title}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {idea.deleted_at && (
                    <Message
                      id="trash.movedBy"
                      values={{
                        name: <bdi>{partnerName(lookups, idea.deleted_by)}</bdi>,
                        time: <TimeAgo iso={idea.deleted_at} />,
                      }}
                    />
                  )}
                </p>
                <p className="text-sm text-slate-500">
                  {t('trash.statusBefore', { status: t(STATUS_LABEL[idea.status]) })}
                </p>
              </div>
              <button
                type="button"
                className="btn-primary"
                disabled={restoringId !== null}
                onClick={() => void restore(idea)}
              >
                {restoringId === idea.id ? t('trash.restoring') : t('trash.restore')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
