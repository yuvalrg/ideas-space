import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { t, type MessageKey } from '../lib/i18n';
import { errorMessageKey } from '../lib/supabase';
import { TimeAgo } from '../components/TimeAgo';
import { useAuth } from '../features/auth/authContext';
import { partnerName, useLookups } from '../features/ideas/useLookups';
import { QUESTION_STATUS_LABEL, listQuestions, type QuestionRow } from '../features/items/api';

type Filter = 'all' | 'mine' | 'unassigned' | 'answered';

const FILTERS: { key: Filter; label: MessageKey }[] = [
  { key: 'all', label: 'questions.filterAll' },
  { key: 'mine', label: 'questions.filterMine' },
  { key: 'unassigned', label: 'questions.filterUnassigned' },
  { key: 'answered', label: 'questions.filterAnswered' },
];

function matches(filter: Filter, row: QuestionRow, myId: string | undefined): boolean {
  const answered = row.item.question_status === 'answered';
  switch (filter) {
    case 'answered':
      return answered;
    case 'mine':
      return !answered && row.item.assignee_id === myId;
    case 'unassigned':
      return !answered && row.item.assignee_id === null;
    default:
      return !answered;
  }
}

/**
 * Open questions across all ideas (spec section 6). "All" means every question not yet answered;
 * an answered question leaves it (acceptance criterion 6) and appears under "answered".
 */
export function QuestionsRoute() {
  const { profile } = useAuth();
  const lookups = useLookups();
  const [params, setParams] = useSearchParams();
  const filter = (params.get('filter') as Filter | null) ?? 'all';
  const [rows, setRows] = useState<QuestionRow[] | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    listQuestions().then(
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

  const visible = useMemo(
    () => (rows ?? []).filter((row) => matches(filter, row, profile?.id)),
    [rows, filter, profile?.id],
  );

  return (
    <section>
      <h1 className="text-2xl font-bold text-slate-900">{t('questions.title')}</h1>

      <div
        role="group"
        aria-label={t('questions.filterLabel')}
        className="mt-6 flex flex-wrap gap-2"
      >
        {FILTERS.map((option) => (
          <button
            key={option.key}
            type="button"
            aria-pressed={filter === option.key}
            onClick={() =>
              setParams(option.key === 'all' ? {} : { filter: option.key }, { replace: true })
            }
            className={`min-h-11 rounded-lg px-4 text-sm font-medium ${
              filter === option.key
                ? 'bg-slate-900 text-white'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {t(option.label)}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-6 font-medium text-red-700">
          {t(error)}
        </p>
      )}

      {!rows ? (
        !error && (
          <p role="status" className="mt-6 text-slate-500">
            {t('common.loading')}
          </p>
        )
      ) : visible.length === 0 ? (
        <p className="mt-6 text-slate-600">{t('questions.empty')}</p>
      ) : (
        <>
          <p className="mt-6 text-sm text-slate-500" aria-live="polite">
            {visible.length === 1
              ? t('questions.countOne')
              : t('questions.count', { count: visible.length })}
          </p>
          <div className="card mt-3 overflow-hidden p-0">
            <div className="hidden gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-500 md:grid md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_6rem_8rem_7rem_7rem]">
              <span>{t('questions.colQuestion')}</span>
              <span>{t('questions.colIdea')}</span>
              <span>{t('questions.colStatus')}</span>
              <span>{t('questions.colAssignee')}</span>
              <span>{t('questions.colOpened')}</span>
              <span>{t('questions.colUpdated')}</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {visible.map(({ item, ideaTitle }) => (
                <li key={item.id}>
                  <Link
                    to={`/ideas/${item.idea_id}#item-${item.id}`}
                    className="grid gap-1 px-4 py-3 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_6rem_8rem_7rem_7rem] md:items-center md:gap-3"
                  >
                    <span className="font-medium text-slate-900" data-user-content>
                      {item.content}
                    </span>
                    <span className="truncate text-sm text-slate-600" data-user-content>
                      {ideaTitle}
                    </span>
                    <span className="text-sm text-slate-700">
                      {item.question_status && t(QUESTION_STATUS_LABEL[item.question_status])}
                    </span>
                    <span className="truncate text-sm text-slate-700">
                      {item.assignee_id ? (
                        <bdi>{partnerName(lookups, item.assignee_id)}</bdi>
                      ) : (
                        <span className="text-slate-400">{t('items.noAssignee')}</span>
                      )}
                    </span>
                    <span className="text-sm text-slate-500">
                      <TimeAgo iso={item.created_at} />
                    </span>
                    <span className="text-sm text-slate-500">
                      <TimeAgo iso={item.updated_at} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
