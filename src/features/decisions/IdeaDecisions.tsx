import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { t, type MessageKey } from '../../lib/i18n';
import { Message } from '../../lib/i18n/Message';
import { errorMessageKey } from '../../lib/supabase';
import { formatDate } from '../../lib/format';
import { Dialog } from '../../components/Dialog';
import { TimeAgo } from '../../components/TimeAgo';
import { IDEA_STATUSES, STATUS_LABEL, type IdeaStatus } from '../ideas/api';
import { partnerName, type Lookups } from '../ideas/useLookups';
import { deleteDecision, listDecisions, recordDecision, type Decision } from './api';

const EMPTY = {
  content: '',
  reason: '',
  basis: '',
  nextStep: '',
  assigneeId: '',
  dueDate: '',
  newStatus: '',
};

/**
 * "Decisions and next step" on the idea page (spec section 6). One required field; saving writes
 * the next step, assignee and due date to the idea and changes its status when chosen
 * (acceptance criterion 9). The idea page reloads so its header and card show the change.
 */
export function IdeaDecisions({
  ideaId,
  lookups,
  onIdeaChanged,
}: {
  ideaId: string;
  lookups: Lookups | null;
  onIdeaChanged: () => void;
}) {
  const id = useId();
  const [decisions, setDecisions] = useState<Decision[] | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [values, setValues] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Decision | null>(null);

  const reload = useCallback(async () => {
    setDecisions(await listDecisions(ideaId));
  }, [ideaId]);

  useEffect(() => {
    let cancelled = false;
    listDecisions(ideaId).then(
      (list) => {
        if (!cancelled) setDecisions(list);
      },
      (cause: unknown) => {
        if (!cancelled) setError(errorMessageKey(cause));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [ideaId]);

  const set = (field: keyof typeof EMPTY) => (value: string) =>
    setValues((current) => ({ ...current, [field]: value }));

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values.content.trim()) return setError('errors.content_required');
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await recordDecision(ideaId, {
        content: values.content.trim(),
        reason: values.reason.trim(),
        basis: values.basis.trim(),
        nextStep: values.nextStep.trim(),
        assigneeId: values.assigneeId || null,
        dueDate: values.dueDate || null,
        newStatus: (values.newStatus || null) as IdeaStatus | null,
      });
      setValues(EMPTY);
      setFormOpen(false);
      setNotice(t('decisions.saved'));
      await reload();
      onIdeaChanged();
    } catch (cause) {
      // The form keeps everything (hard rule 6).
      setError(errorMessageKey(cause));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    const decision = deleting;
    setDeleting(null);
    if (!decision) return;
    try {
      await deleteDecision(decision.id);
      setDecisions((list) => list?.filter((d) => d.id !== decision.id) ?? null);
    } catch (cause) {
      setError(errorMessageKey(cause));
    }
  }

  const field = (name: keyof typeof EMPTY, label: MessageKey, rows = 2) => (
    <div>
      <label htmlFor={`${id}-${name}`} className="field-label">
        {t(label)}
      </label>
      <textarea
        id={`${id}-${name}`}
        value={values[name]}
        onChange={(event) => set(name)(event.target.value)}
        rows={rows}
        className="field-input mt-1 py-2"
      />
    </div>
  );

  return (
    <section className="card mt-6" aria-labelledby="idea-decisions">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="idea-decisions" className="text-lg font-bold text-slate-900">
          {t('decisions.title')}
        </h2>
        {!formOpen && (
          <button type="button" className="btn-primary" onClick={() => setFormOpen(true)}>
            {t('decisions.open')}
          </button>
        )}
      </div>

      {notice && !formOpen && (
        <p role="status" className="mt-3 text-sm font-medium text-emerald-700">
          {notice}
        </p>
      )}

      {formOpen && (
        <form onSubmit={onSubmit} noValidate className="mt-4 space-y-4 rounded-xl bg-slate-50 p-4">
          {field('content', 'decisions.contentLabel', 3)}
          <div className="grid gap-4 md:grid-cols-2">
            {field('reason', 'decisions.reasonLabel')}
            {field('basis', 'decisions.basisLabel')}
          </div>
          <p className="text-sm text-slate-600">{t('decisions.ideaHint')}</p>
          {field('nextStep', 'decisions.nextStepLabel')}
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label htmlFor={`${id}-assignee`} className="field-label">
                {t('decisions.assigneeLabel')}
              </label>
              <select
                id={`${id}-assignee`}
                value={values.assigneeId}
                onChange={(event) => set('assigneeId')(event.target.value)}
                className="field-input mt-1"
              >
                <option value="">{t('items.noAssignee')}</option>
                {lookups?.activePartners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${id}-due`} className="field-label">
                {t('decisions.dueLabel')}
              </label>
              <input
                id={`${id}-due`}
                type="date"
                value={values.dueDate}
                onChange={(event) => set('dueDate')(event.target.value)}
                className="field-input mt-1"
              />
            </div>
            <div>
              <label htmlFor={`${id}-status`} className="field-label">
                {t('decisions.statusLabel')}
              </label>
              <select
                id={`${id}-status`}
                value={values.newStatus}
                onChange={(event) => set('newStatus')(event.target.value)}
                className="field-input mt-1"
              >
                <option value="">{t('decisions.statusKeep')}</option>
                {IDEA_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {t(STATUS_LABEL[status])}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? t('decisions.saving') : t('decisions.save')}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setFormOpen(false)}>
              {t('common.cancel')}
            </button>
            {error && (
              <p role="alert" className="text-sm font-medium text-red-700">
                {t(error)}
              </p>
            )}
          </div>
        </form>
      )}

      {!formOpen && error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-700">
          {t(error)}
        </p>
      )}

      {decisions && decisions.length === 0 && !formOpen && (
        <p className="mt-3 text-sm text-slate-500">{t('decisions.empty')}</p>
      )}
      {decisions && decisions.length > 0 && (
        <ul className="mt-4 space-y-3">
          {decisions.map((decision) => (
            <li key={decision.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-xs text-slate-500">
                  <Message
                    id="items.by"
                    values={{
                      name: <bdi>{partnerName(lookups, decision.created_by)}</bdi>,
                      time: <TimeAgo iso={decision.created_at} />,
                    }}
                  />
                </p>
                <button
                  type="button"
                  onClick={() => setDeleting(decision)}
                  className="min-h-11 rounded-lg px-2 text-sm text-slate-500 hover:bg-slate-100 hover:text-red-700"
                >
                  {t('items.delete')}
                </button>
              </div>
              <p className="whitespace-pre-wrap font-medium text-slate-900" data-user-content>
                {decision.content}
              </p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {decision.reason && (
                  <li data-user-content>{t('decisions.reason', { text: decision.reason })}</li>
                )}
                {decision.basis && (
                  <li data-user-content>{t('decisions.basis', { text: decision.basis })}</li>
                )}
                {decision.next_step && (
                  <li data-user-content>{t('decisions.nextStep', { text: decision.next_step })}</li>
                )}
                {decision.assignee_id && (
                  <li>
                    <Message
                      id="decisions.assignee"
                      values={{ name: <bdi>{partnerName(lookups, decision.assignee_id)}</bdi> }}
                    />
                  </li>
                )}
                {decision.due_date && (
                  <li>{t('decisions.due', { date: formatDate(decision.due_date) })}</li>
                )}
                {decision.new_status && (
                  <li>{t('decisions.status', { status: t(STATUS_LABEL[decision.new_status]) })}</li>
                )}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={deleting !== null}
        title={t('decisions.deleteTitle')}
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
        <p className="text-slate-700">{t('decisions.deleteText')}</p>
      </Dialog>
    </section>
  );
}
