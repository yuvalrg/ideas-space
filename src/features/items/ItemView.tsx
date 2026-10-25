import { useState, type FormEvent } from 'react';
import { t, type MessageKey } from '../../lib/i18n';
import { Message } from '../../lib/i18n/Message';
import { errorMessageKey } from '../../lib/supabase';
import { Dialog } from '../../components/Dialog';
import { TimeAgo } from '../../components/TimeAgo';
import { partnerName, type Lookups } from '../ideas/useLookups';
import {
  ITEM_TYPE_LABEL,
  QUESTION_STATUS_LABEL,
  answerQuestion,
  deleteItem,
  setAssignee,
  setQuestionStatus,
  type Item,
  type QuestionStatus,
} from './api';

const TYPE_STYLE = {
  thought: 'bg-violet-50 text-violet-800 ring-violet-200',
  question: 'bg-amber-50 text-amber-800 ring-amber-200',
  info: 'bg-sky-50 text-sky-800 ring-sky-200',
} as const;

const QUESTION_STYLE: Record<QuestionStatus, string> = {
  open: 'text-amber-800',
  in_review: 'text-blue-800',
  answered: 'text-emerald-800',
};

/**
 * One thought, question or info: who wrote it and when (acceptance criterion 5). Questions also
 * carry a status, an assignee and the answer form (criterion 6).
 */
export function ItemView({
  item,
  lookups,
  highlighted,
  onChanged,
  onDeleted,
}: {
  item: Item;
  lookups: Lookups | null;
  highlighted: boolean;
  onChanged: (item: Item) => void;
  onDeleted: (id: string) => void;
}) {
  const [answering, setAnswering] = useState(false);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isQuestion = item.type === 'question';
  const status = item.question_status;

  async function run(action: () => Promise<Item | null>) {
    setBusy(true);
    setError(null);
    try {
      const updated = await action();
      if (updated) onChanged(updated);
      return true;
    } catch (cause) {
      setError(errorMessageKey(cause));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!answer.trim()) return setError('items.answerRequired');
    const ok = await run(() => answerQuestion(item.id, answer.trim()));
    if (ok) {
      setAnswering(false);
      setAnswer('');
    }
  }

  return (
    <li
      id={`item-${item.id}`}
      className={`scroll-mt-24 rounded-xl border bg-white p-4 ${
        highlighted ? 'border-blue-400 ring-2 ring-blue-200' : 'border-slate-200'
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TYPE_STYLE[item.type]}`}
        >
          {t(ITEM_TYPE_LABEL[item.type])}
        </span>
        {isQuestion && status && (
          <span className={`text-xs font-medium ${QUESTION_STYLE[status]}`}>
            {t(QUESTION_STATUS_LABEL[status])}
          </span>
        )}
        <span className="text-slate-500">
          <Message
            id="items.by"
            values={{
              name: <bdi>{partnerName(lookups, item.created_by)}</bdi>,
              time: <TimeAgo iso={item.created_at} />,
            }}
          />
        </span>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          disabled={busy}
          className="ms-auto min-h-11 rounded-lg px-2 text-sm text-slate-500 hover:bg-slate-100 hover:text-red-700"
        >
          {t('items.delete')}
        </button>
      </div>

      <p className="mt-2 whitespace-pre-wrap text-slate-800" data-user-content>
        {item.content}
      </p>

      {isQuestion && status === 'answered' && (
        <div className="mt-3 rounded-lg bg-emerald-50 p-3">
          <p className="whitespace-pre-wrap text-slate-800" data-user-content>
            {item.answer}
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-3 text-xs text-emerald-900">
            {item.answered_at && (
              <span>
                <Message
                  id="items.answeredBy"
                  values={{
                    name: <bdi>{partnerName(lookups, item.answered_by)}</bdi>,
                    time: <TimeAgo iso={item.answered_at} />,
                  }}
                />
              </span>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => setQuestionStatus(item.id, 'open'))}
              className="font-medium underline"
            >
              {t('items.reopen')}
            </button>
          </p>
        </div>
      )}

      {isQuestion && status !== 'answered' && (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor={`status-${item.id}`} className="field-label text-xs">
              {t('items.statusLabel')}
            </label>
            <select
              id={`status-${item.id}`}
              value={status ?? 'open'}
              disabled={busy}
              onChange={(event) =>
                void run(() => setQuestionStatus(item.id, event.target.value as QuestionStatus))
              }
              className="field-input mt-1 w-auto"
            >
              <option value="open">{t('questionStatus.open')}</option>
              <option value="in_review">{t('questionStatus.in_review')}</option>
            </select>
          </div>
          <div>
            <label htmlFor={`assignee-${item.id}`} className="field-label text-xs">
              {t('items.assigneeLabel')}
            </label>
            <select
              id={`assignee-${item.id}`}
              value={item.assignee_id ?? ''}
              disabled={busy}
              onChange={(event) => void run(() => setAssignee(item.id, event.target.value || null))}
              className="field-input mt-1 w-auto"
            >
              <option value="">{t('items.noAssignee')}</option>
              {lookups?.activePartners.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.name}
                </option>
              ))}
              {item.assignee_id &&
                !lookups?.activePartners.some((partner) => partner.id === item.assignee_id) && (
                  <option value={item.assignee_id}>{partnerName(lookups, item.assignee_id)}</option>
                )}
            </select>
          </div>
          {!answering && (
            <button type="button" onClick={() => setAnswering(true)} className="btn-secondary">
              {t('items.answer')}
            </button>
          )}
        </div>
      )}

      {answering && (
        <form onSubmit={onAnswer} noValidate className="mt-3 space-y-2">
          <label htmlFor={`answer-${item.id}`} className="field-label">
            {t('items.answerLabel')}
          </label>
          <textarea
            id={`answer-${item.id}`}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            rows={3}
            autoFocus
            className="field-input py-2"
          />
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={busy} className="btn-primary">
              {t('items.answerSave')}
            </button>
            <button type="button" onClick={() => setAnswering(false)} className="btn-secondary">
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700">
          {t(error)}
        </p>
      )}

      <Dialog
        open={confirmDelete}
        title={t('items.deleteTitle')}
        onClose={() => setConfirmDelete(false)}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => setConfirmDelete(false)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn-primary bg-red-600 hover:bg-red-700"
              disabled={busy}
              onClick={() => {
                setConfirmDelete(false);
                void run(async () => {
                  await deleteItem(item.id);
                  onDeleted(item.id);
                  return null;
                });
              }}
            >
              {t('items.delete')}
            </button>
          </>
        }
      >
        <p className="text-slate-700">{t('items.deleteText')}</p>
      </Dialog>
    </li>
  );
}
