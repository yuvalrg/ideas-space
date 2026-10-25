import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { t, type MessageKey } from '../lib/i18n';
import { Message } from '../lib/i18n/Message';
import { errorMessageKey } from '../lib/supabase';
import { formatDate, isPastDue } from '../lib/format';
import { TimeAgo } from '../components/TimeAgo';
import { ActionsMenu, menuItemClass } from '../components/ActionsMenu';
import {
  IDEA_STATUSES,
  SECTION_KEYS,
  SECTION_LABEL,
  STATUS_LABEL,
  duplicateIdea,
  getIdea,
  setIdeaStatus,
  type Idea,
  type IdeaStatus,
  type Sections,
  type Snapshot,
} from '../features/ideas/api';
import { CategoryChip } from '../features/ideas/badges';
import { clearDraft, readDraft, sameSnapshot, type Draft } from '../features/ideas/draft';
import { IdeaEditor } from '../features/ideas/IdeaEditor';
import { partnerName, useLookups } from '../features/ideas/useLookups';
import { IdeaItems } from '../features/items/IdeaItems';
import { trashIdea } from '../features/trash/api';
import { Dialog } from '../components/Dialog';
import { IdeaResources } from '../features/resources/IdeaResources';
import { IdeaDecisions } from '../features/decisions/IdeaDecisions';

type Loaded = { idea: Idea; sections: Sections } | 'notFound';

function snapshotOf(idea: Idea, sections: Sections): Snapshot {
  return { title: idea.title, summary: idea.summary, category_id: idea.category_id, sections };
}

/**
 * Idea page, step 3 part (spec section 6): header with status, category, who and when; the current
 * description and the 10 development sections; editing with versions, drafts and conflicts.
 * Thoughts, questions, resources, decisions and activity are added in steps 4-6.
 */
export function IdeaRoute() {
  const { id = '' } = useParams();
  // Keyed by id: a duplicate opens a fresh page (and draft state) for the new idea.
  return <IdeaPage key={id} id={id} />;
}

function IdeaPage({ id }: { id: string }) {
  const navigate = useNavigate();
  const lookups = useLookups();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ initial: Snapshot; baseVersion: number } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(() => readDraft(id));
  const [busy, setBusy] = useState(false);
  const [confirmTrash, setConfirmTrash] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await getIdea(id);
      setLoaded(result ?? 'notFound');
      setError(null);
    } catch (cause) {
      setError(errorMessageKey(cause));
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    getIdea(id).then(
      (result) => {
        if (!cancelled) setLoaded(result ?? 'notFound');
      },
      (cause: unknown) => {
        if (!cancelled) setError(errorMessageKey(cause));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error && !loaded) {
    return (
      <p role="alert" className="font-medium text-red-700">
        {t(error)}
      </p>
    );
  }
  if (!loaded)
    return (
      <p role="status" className="text-slate-500">
        {t('common.loading')}
      </p>
    );
  if (loaded === 'notFound') {
    return (
      <section>
        <p className="text-slate-700">{t('errors.idea_not_found')}</p>
        <Link to="/" className="btn-secondary mt-4">
          {t('idea.back')}
        </Link>
      </section>
    );
  }

  const { idea, sections } = loaded;
  const current = snapshotOf(idea, sections);
  const category = lookups?.categories.find((c) => c.id === idea.category_id);
  // A draft that matches what is saved is not worth offering.
  const pendingDraft = draft && !sameSnapshot(draft.values, current) ? draft : null;

  async function changeStatus(status: IdeaStatus) {
    setBusy(true);
    setNotice(null);
    try {
      await setIdeaStatus(id, status);
      await load();
      setNotice(t('idea.statusSaved'));
    } catch (cause) {
      setError(errorMessageKey(cause));
    } finally {
      setBusy(false);
    }
  }

  async function duplicate() {
    setBusy(true);
    try {
      const newId = await duplicateIdea(id, t('idea.duplicatePrefix', { title: idea.title }));
      navigate(`/ideas/${newId}`);
    } catch (cause) {
      setError(errorMessageKey(cause));
      setBusy(false);
    }
  }

  async function moveToTrash() {
    setConfirmTrash(false);
    setBusy(true);
    try {
      await trashIdea(id);
      navigate('/', { state: { notice: t('idea.trashed', { title: idea.title }) } });
    } catch (cause) {
      setError(errorMessageKey(cause));
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <section>
        <h1 className="mb-6 text-2xl font-bold text-slate-900" data-user-content>
          {idea.title}
        </h1>
        <IdeaEditor
          ideaId={id}
          baseVersion={editing.baseVersion}
          original={current}
          initial={editing.initial}
          categories={lookups?.categories ?? []}
          onSaved={(version, changed) => {
            setEditing(null);
            setDraft(null);
            setNotice(changed ? t('idea.saved', { n: version }) : t('idea.noChanges'));
            void load();
          }}
          onCancel={() => {
            setEditing(null);
            setDraft(null);
          }}
          onReloadRequested={() => {
            setEditing(null);
            setDraft(readDraft(id));
            void load();
          }}
        />
      </section>
    );
  }

  return (
    <article>
      <Link to="/" className="text-sm font-medium text-blue-700 hover:underline">
        {t('idea.back')}
      </Link>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl" data-user-content>
            {idea.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="sr-only" htmlFor="idea-status">
              {t('idea.statusLabel')}
            </label>
            <select
              id="idea-status"
              value={idea.status}
              disabled={busy}
              onChange={(event) => void changeStatus(event.target.value as IdeaStatus)}
              className="field-input w-auto font-medium"
            >
              {IDEA_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(STATUS_LABEL[status])}
                </option>
              ))}
            </select>
            <CategoryChip category={category} />
            <span className="text-xs text-slate-500">
              {t('idea.versionBadge', { n: idea.version_no })}
            </span>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            <Message
              id="idea.meta"
              values={{
                creator: <span data-user-content>{partnerName(lookups, idea.created_by)}</span>,
                created: <TimeAgo iso={idea.created_at} />,
                updated: <TimeAgo iso={idea.updated_at} />,
                updater: <span data-user-content>{partnerName(lookups, idea.updated_by)}</span>,
              }}
            />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-primary"
            onClick={() => setEditing({ initial: current, baseVersion: idea.version_no })}
          >
            {t('idea.edit')}
          </button>
          <ActionsMenu label={t('idea.moreActions')}>
            <Link to={`/ideas/${id}/versions`} className={menuItemClass}>
              {t('idea.versions')}
            </Link>
            <button
              type="button"
              className={menuItemClass}
              disabled={busy}
              onClick={() => void duplicate()}
            >
              {t('idea.duplicate')}
            </button>
            <button
              type="button"
              className={`${menuItemClass} text-red-700`}
              disabled={busy}
              onClick={() => setConfirmTrash(true)}
            >
              {t('idea.trash')}
            </button>
          </ActionsMenu>
          <Dialog
            open={confirmTrash}
            title={t('idea.trashTitle')}
            onClose={() => setConfirmTrash(false)}
            actions={
              <>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setConfirmTrash(false)}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className="btn-primary bg-red-600 hover:bg-red-700"
                  onClick={() => void moveToTrash()}
                >
                  {t('idea.trash')}
                </button>
              </>
            }
          >
            <p className="text-slate-700">{t('idea.trashText')}</p>
          </Dialog>
        </div>
      </header>

      {(notice || error) && (
        <p
          role={error ? 'alert' : 'status'}
          className={`mt-4 text-sm font-medium ${error ? 'text-red-700' : 'text-emerald-700'}`}
        >
          {error ? t(error) : notice}
        </p>
      )}

      {pendingDraft && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-amber-900">
            <Message id="draft.found" values={{ time: <TimeAgo iso={pendingDraft.savedAt} /> }} />
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={() =>
              setEditing({ initial: pendingDraft.values, baseVersion: pendingDraft.baseVersion })
            }
          >
            {t('draft.restore')}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              clearDraft(id);
              setDraft(null);
            }}
          >
            {t('draft.discard')}
          </button>
        </div>
      )}

      {(idea.next_step || idea.owner_id || idea.next_step_due) && (
        <dl className="card mt-6 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium text-slate-500">{t('idea.nextStep')}</dt>
            <dd className="mt-1 text-slate-800" data-user-content>
              {idea.next_step}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">{t('idea.owner')}</dt>
            <dd className="mt-1 text-slate-800" data-user-content>
              {partnerName(lookups, idea.owner_id)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">{t('idea.due')}</dt>
            <dd
              className={`mt-1 ${isPastDue(idea.next_step_due) ? 'font-medium text-red-700' : 'text-slate-800'}`}
            >
              {idea.next_step_due ? formatDate(idea.next_step_due) : ''}
            </dd>
          </div>
        </dl>
      )}

      <section className="card mt-6" aria-labelledby="idea-current">
        <h2 id="idea-current" className="text-lg font-bold text-slate-900">
          {t('idea.currentTitle')}
        </h2>
        <p className="mt-3 whitespace-pre-wrap text-slate-800" data-user-content>
          {idea.summary}
        </p>
      </section>

      <section className="card mt-6" aria-labelledby="idea-development">
        <h2 id="idea-development" className="text-lg font-bold text-slate-900">
          {t('idea.developmentTitle')}
        </h2>
        <dl className="mt-4 divide-y divide-slate-100">
          {SECTION_KEYS.map((key) => (
            <div key={key} className="py-4 first:pt-0 last:pb-0">
              <dt className="font-medium text-slate-900">{t(SECTION_LABEL[key])}</dt>
              <dd className="mt-1">
                {sections[key] ? (
                  <p className="whitespace-pre-wrap text-slate-700" data-user-content>
                    {sections[key]}
                  </p>
                ) : (
                  <p className="text-sm text-slate-400">{t('idea.emptySection')}</p>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <IdeaItems ideaId={id} lookups={lookups} />
      <IdeaResources ideaId={id} lookups={lookups} />
      <IdeaDecisions ideaId={id} lookups={lookups} onIdeaChanged={() => void load()} />
    </article>
  );
}
