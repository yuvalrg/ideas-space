import { useCallback, useEffect, useState } from 'react';
import { t, type MessageKey } from '../../lib/i18n';
import { Message } from '../../lib/i18n/Message';
import { errorMessageKey } from '../../lib/supabase';
import { Dialog } from '../../components/Dialog';
import { TimeAgo } from '../../components/TimeAgo';
import { partnerName, type Lookups } from '../ideas/useLookups';
import { deleteResource, listResources, signedFileUrl, type ResourceRow } from './api';
import { ResourceForm } from './ResourceForm';
import { formatSize } from './upload';

/** "Resources and files" on the idea page (spec sections 6 and 9). */
export function IdeaResources({ ideaId, lookups }: { ideaId: string; lookups: Lookups | null }) {
  const [rows, setRows] = useState<ResourceRow[] | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const [deleting, setDeleting] = useState<ResourceRow | null>(null);

  const reload = useCallback(async () => {
    try {
      setRows(await listResources(ideaId));
    } catch (cause) {
      setError(errorMessageKey(cause));
    }
  }, [ideaId]);

  useEffect(() => {
    let cancelled = false;
    listResources(ideaId).then(
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
  }, [ideaId]);

  async function openFile(row: ResourceRow) {
    if (!row.file) return;
    // Open the tab during the click (pop-up blockers), then point it at the signed link.
    const tab = window.open('', '_blank');
    try {
      const url = await signedFileUrl(row.file);
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else {
        window.location.assign(url); // pop-ups blocked: open in this tab
      }
    } catch (cause) {
      tab?.close();
      setError(errorMessageKey(cause));
    }
  }

  async function confirmDelete() {
    const row = deleting;
    setDeleting(null);
    if (!row) return;
    try {
      await deleteResource(row.resource.id);
      setRows((list) => list?.filter((r) => r.resource.id !== row.resource.id) ?? null);
    } catch (cause) {
      setError(errorMessageKey(cause));
    }
  }

  return (
    <section className="card mt-6" aria-labelledby="idea-resources">
      <h2 id="idea-resources" className="text-lg font-bold text-slate-900">
        {t('resources.title')}
      </h2>

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-700">
          {t(error)}
        </p>
      )}
      {rows && rows.length === 0 && (
        <p className="mt-3 text-sm text-slate-500">{t('resources.empty')}</p>
      )}
      {rows && rows.length > 0 && (
        <ul className="mt-4 space-y-3">
          {rows.map((row) => {
            const { resource, file } = row;
            return (
              <li key={resource.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    {resource.kind === 'link' && resource.url ? (
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium break-words text-blue-700 hover:underline"
                        data-user-content
                      >
                        {resource.title || resource.url}
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void openFile(row)}
                        title={t('resources.openHint')}
                        className="text-start font-medium break-words text-blue-700 hover:underline"
                        data-user-content
                      >
                        {resource.title || file?.original_name}
                      </button>
                    )}
                    <p className="mt-1 text-xs text-slate-500">
                      {t(resource.kind === 'link' ? 'resources.kindLink' : 'resources.kindFile')}
                      {file && (
                        <>
                          {' · '}
                          <bdi>{file.original_name}</bdi> · {formatSize(file.size_bytes)}
                        </>
                      )}
                      {' · '}
                      <Message
                        id="items.by"
                        values={{
                          name: <bdi>{partnerName(lookups, resource.created_by)}</bdi>,
                          time: <TimeAgo iso={resource.created_at} />,
                        }}
                      />
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleting(row)}
                    className="min-h-11 rounded-lg px-2 text-sm text-slate-500 hover:bg-slate-100 hover:text-red-700"
                  >
                    {t('items.delete')}
                  </button>
                </div>
                {resource.description && (
                  <p className="mt-2 whitespace-pre-wrap text-slate-700" data-user-content>
                    {resource.description}
                  </p>
                )}
                {resource.relevance && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600" data-user-content>
                    {t('resources.relevance', { text: resource.relevance })}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-6 border-t border-slate-100 pt-5">
        <ResourceForm ideaId={ideaId} onAdded={() => void reload()} />
      </div>

      <Dialog
        open={deleting !== null}
        title={t('resources.deleteTitle')}
        onClose={() => setDeleting(null)}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => setDeleting(null)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn-primary bg-red-600 hover:bg-red-700"
              onClick={() => void confirmDelete()}
            >
              {t('items.delete')}
            </button>
          </>
        }
      >
        <p className="text-slate-700">{t('resources.deleteText')}</p>
      </Dialog>
    </section>
  );
}
