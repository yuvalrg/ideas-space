import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { t, type MessageKey } from '../lib/i18n';
import { Message } from '../lib/i18n/Message';
import { errorMessageKey } from '../lib/supabase';
import { Dialog } from '../components/Dialog';
import { TimeAgo } from '../components/TimeAgo';
import {
  SECTION_KEYS,
  SECTION_LABEL,
  listVersions,
  restoreVersion,
  type Version,
} from '../features/ideas/api';
import { partnerName, useLookups } from '../features/ideas/useLookups';

function changeLabel(version: Version): string {
  if (version.change_type === 'create') return t('versions.changeCreate');
  if (version.change_type === 'edit') return t('versions.changeEdit');
  return t('versions.changeRestore', { n: version.restored_from_version ?? '' });
}

/**
 * Version history (spec section 8): every save is a version; restoring makes a new version and
 * deletes nothing (acceptance criteria 3 and 13).
 */
export function IdeaVersionsRoute() {
  const { id = '' } = useParams();
  const lookups = useLookups();
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [selectedNo, setSelectedNo] = useState<number | null>(null);
  const [confirmNo, setConfirmNo] = useState<number | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const list = await listVersions(id);
    setVersions(list);
    return list;
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    listVersions(id).then(
      (list) => {
        if (!cancelled) setVersions(list);
      },
      (cause: unknown) => {
        if (!cancelled) setError(errorMessageKey(cause));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id]);

  const latestNo = versions?.[0]?.version_no ?? null;
  const selected = versions?.find((v) => v.version_no === (selectedNo ?? latestNo)) ?? null;
  const category = lookups?.categories.find((c) => c.id === selected?.snapshot.category_id);

  async function restore(versionNo: number) {
    setRestoring(true);
    setError(null);
    setNotice(null);
    try {
      const newNo = await restoreVersion(id, versionNo);
      await reload();
      setSelectedNo(newNo);
      setNotice(t('versions.restored', { n: newNo }));
    } catch (cause) {
      setError(errorMessageKey(cause));
    } finally {
      setRestoring(false);
      setConfirmNo(null);
    }
  }

  return (
    <section>
      <Link to={`/ideas/${id}`} className="text-sm font-medium text-blue-700 hover:underline">
        {t('versions.back')}
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">{t('versions.title')}</h1>

      {(notice || error) && (
        <p
          role={error ? 'alert' : 'status'}
          className={`mt-4 text-sm font-medium ${error ? 'text-red-700' : 'text-emerald-700'}`}
        >
          {error ? t(error) : notice}
        </p>
      )}

      {!versions ? (
        !error && (
          <p role="status" className="mt-6 text-slate-500">
            {t('common.loading')}
          </p>
        )
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <ol className="card space-y-1 p-2">
            {versions.map((version) => {
              const isSelected = version.version_no === selected?.version_no;
              return (
                <li key={version.version_no}>
                  <button
                    type="button"
                    aria-current={isSelected ? 'true' : undefined}
                    onClick={() => setSelectedNo(version.version_no)}
                    className={`w-full rounded-lg px-3 py-2 text-start ${
                      isSelected ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-900">
                        {t('versions.label', { n: version.version_no })}
                      </span>
                      {version.version_no === latestNo && (
                        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs text-white">
                          {t('versions.current')}
                        </span>
                      )}
                    </span>
                    <span className="block text-sm text-slate-600">{changeLabel(version)}</span>
                    <span className="block text-xs text-slate-500">
                      <Message
                        id="versions.by"
                        values={{
                          name: (
                            <span data-user-content>
                              {partnerName(lookups, version.created_by)}
                            </span>
                          ),
                          time: <TimeAgo iso={version.created_at} />,
                        }}
                      />
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {selected && (
            <div className="card space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-slate-500">
                    {t('versions.label', { n: selected.version_no })} · {changeLabel(selected)}
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900" data-user-content>
                    {selected.snapshot.title}
                  </h2>
                  {category && <p className="mt-1 text-sm text-slate-600">{category.name}</p>}
                </div>
                {selected.version_no !== latestNo && (
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={restoring}
                    onClick={() => setConfirmNo(selected.version_no)}
                  >
                    {t('versions.restore')}
                  </button>
                )}
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-500">{t('idea.summaryLabel')}</h3>
                <p className="mt-1 whitespace-pre-wrap text-slate-800" data-user-content>
                  {selected.snapshot.summary}
                </p>
              </div>
              <dl className="divide-y divide-slate-100">
                {SECTION_KEYS.filter((key) => selected.snapshot.sections[key]).map((key) => (
                  <div key={key} className="py-3">
                    <dt className="text-sm font-medium text-slate-500">{t(SECTION_LABEL[key])}</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-slate-800" data-user-content>
                      {selected.snapshot.sections[key]}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      )}

      <Dialog
        open={confirmNo !== null}
        title={t('versions.restoreConfirmTitle', { n: confirmNo ?? '' })}
        onClose={() => setConfirmNo(null)}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => setConfirmNo(null)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={restoring}
              onClick={() => confirmNo !== null && void restore(confirmNo)}
            >
              {restoring ? t('versions.restoring') : t('versions.restore')}
            </button>
          </>
        }
      >
        <p className="text-slate-700">{t('versions.restoreConfirmText', { n: confirmNo ?? '' })}</p>
      </Dialog>
    </section>
  );
}
