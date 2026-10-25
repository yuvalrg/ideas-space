import { useEffect, useRef, useState, type FormEvent } from 'react';
import { t, type MessageKey } from '../../lib/i18n';
import { Message } from '../../lib/i18n/Message';
import { errorMessageKey } from '../../lib/supabase';
import { Dialog } from '../../components/Dialog';
import { TimeAgo } from '../../components/TimeAgo';
import {
  SECTION_KEYS,
  SECTION_LABEL,
  VersionConflict,
  saveIdea,
  type Category,
  type SectionKey,
  type Snapshot,
} from './api';
import { clearDraft, sameSnapshot, writeDraft } from './draft';

const DRAFT_INTERVAL_MS = 5000;

/**
 * Edit form for the description, category and the 10 sections. One explicit save = one version
 * (spec section 8). The text is kept as a local draft every 5 seconds; a stale version opens the
 * conflict dialog ("load the new version" keeps the text as a draft, "save anyway" overwrites and
 * the other partner's version stays in history).
 */
export function IdeaEditor({
  ideaId,
  baseVersion,
  original,
  initial,
  categories,
  onSaved,
  onCancel,
  onReloadRequested,
}: {
  ideaId: string;
  baseVersion: number;
  /** what is saved on the server now */
  original: Snapshot;
  /** what the form starts with (the original, or a restored draft) */
  initial: Snapshot;
  categories: Category[];
  onSaved: (version: number, changed: boolean) => void;
  onCancel: () => void;
  onReloadRequested: () => void;
}) {
  const [values, setValues] = useState<Snapshot>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [conflict, setConflict] = useState<VersionConflict | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  const dirty = !sameSnapshot(values, original);
  const latest = useRef({ values, dirty });
  useEffect(() => {
    latest.current = { values, dirty };
  });

  // Every 5 seconds, keep unsaved text in this browser.
  useEffect(() => {
    let lastWritten = '';
    const timer = setInterval(() => {
      const { values: current, dirty: isDirty } = latest.current;
      const serialized = JSON.stringify(current);
      if (!isDirty || serialized === lastWritten) return;
      const draft = writeDraft(ideaId, baseVersion, current);
      if (draft) {
        lastWritten = serialized;
        setDraftSavedAt(draft.savedAt);
      }
    }, DRAFT_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [ideaId, baseVersion]);

  function setField(field: 'title' | 'summary', value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function setSection(key: SectionKey, value: string) {
    setValues((current) => ({ ...current, sections: { ...current.sections, [key]: value } }));
  }

  async function save(expectedVersion: number) {
    if (!values.title.trim()) return setError('errors.title_required');
    if (!values.summary.trim()) return setError('errors.summary_required');
    setSaving(true);
    setError(null);
    try {
      const version = await saveIdea(ideaId, expectedVersion, {
        ...values,
        title: values.title.trim(),
        summary: values.summary.trim(),
      });
      clearDraft(ideaId);
      onSaved(version, version !== expectedVersion);
    } catch (cause) {
      // Keep the text: in the form and as a draft (hard rule 6).
      writeDraft(ideaId, baseVersion, values);
      if (cause instanceof VersionConflict) setConflict(cause);
      else setError(errorMessageKey(cause));
    } finally {
      setSaving(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save(baseVersion);
  }

  function cancel() {
    if (dirty) setConfirmDiscard(true);
    else {
      clearDraft(ideaId);
      onCancel();
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-8">
      <section className="card space-y-5" aria-labelledby="edit-current">
        <h2 id="edit-current" className="text-lg font-bold text-slate-900">
          {t('idea.currentTitle')}
        </h2>
        <div>
          <label htmlFor="edit-title" className="field-label">
            {t('idea.titleLabel')}
          </label>
          <input
            id="edit-title"
            value={values.title}
            onChange={(event) => setField('title', event.target.value)}
            maxLength={200}
            className="field-input mt-1"
          />
        </div>
        <div>
          <label htmlFor="edit-summary" className="field-label">
            {t('idea.summaryLabel')}
          </label>
          <textarea
            id="edit-summary"
            value={values.summary}
            onChange={(event) => setField('summary', event.target.value)}
            rows={4}
            className="field-input mt-1 py-2"
          />
        </div>
        <div>
          <label htmlFor="edit-category" className="field-label">
            {t('idea.categoryLabel')}
          </label>
          <select
            id="edit-category"
            value={values.category_id ?? ''}
            onChange={(event) =>
              setValues((current) => ({ ...current, category_id: event.target.value || null }))
            }
            className="field-input mt-1"
          >
            <option value="">{t('idea.noCategory')}</option>
            {categories
              .filter((category) => category.is_active || category.id === values.category_id)
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
          </select>
        </div>
      </section>

      <section className="card space-y-5" aria-labelledby="edit-development">
        <h2 id="edit-development" className="text-lg font-bold text-slate-900">
          {t('idea.developmentTitle')}
        </h2>
        {SECTION_KEYS.map((key) => (
          <div key={key}>
            <label htmlFor={`edit-${key}`} className="field-label">
              {t(SECTION_LABEL[key])}
            </label>
            <textarea
              id={`edit-${key}`}
              value={values.sections[key] ?? ''}
              onChange={(event) => setSection(key, event.target.value)}
              rows={3}
              className="field-input mt-1 py-2"
            />
          </div>
        ))}
      </section>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur md:-mx-10 md:px-10">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? t('idea.saving') : t('idea.save')}
        </button>
        <button type="button" onClick={cancel} disabled={saving} className="btn-secondary">
          {t('idea.cancelEdit')}
        </button>
        {error && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {t(error)}
          </p>
        )}
        {!error && draftSavedAt && (
          <p className="text-sm text-slate-500" aria-live="polite">
            <Message id="draft.autosaved" values={{ time: <TimeAgo iso={draftSavedAt} /> }} />
          </p>
        )}
      </div>

      <Dialog
        open={conflict !== null}
        title={t('conflict.title')}
        onClose={() => setConflict(null)}
        actions={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setConflict(null);
                onReloadRequested();
              }}
            >
              {t('conflict.reload')}
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={saving}
              onClick={() => {
                const current = conflict;
                setConflict(null);
                if (current) void save(current.versionNo);
              }}
            >
              {t('conflict.overwrite')}
            </button>
          </>
        }
      >
        {conflict && (
          <div className="space-y-2 text-slate-700">
            <p>
              <Message
                id="conflict.text"
                values={{
                  name: <span data-user-content>{conflict.updatedByName ?? ''}</span>,
                  time: <TimeAgo iso={conflict.updatedAt} />,
                }}
              />
            </p>
            <p className="text-sm text-slate-500">{t('conflict.reloadHint')}</p>
            <p className="text-sm text-slate-500">
              {t('conflict.overwriteHint', { name: conflict.updatedByName ?? '' })}
            </p>
          </div>
        )}
      </Dialog>

      <Dialog
        open={confirmDiscard}
        title={t('idea.discardTitle')}
        onClose={() => setConfirmDiscard(false)}
        actions={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setConfirmDiscard(false)}
            >
              {t('idea.keepEditing')}
            </button>
            <button
              type="button"
              className="btn-primary bg-red-600 hover:bg-red-700"
              onClick={() => {
                setConfirmDiscard(false);
                clearDraft(ideaId);
                onCancel();
              }}
            >
              {t('idea.discardConfirm')}
            </button>
          </>
        }
      >
        <p className="text-slate-700">{t('idea.discardText')}</p>
      </Dialog>
    </form>
  );
}
