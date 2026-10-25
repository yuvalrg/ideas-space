import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { t, type MessageKey } from '../lib/i18n';
import { errorMessageKey } from '../lib/supabase';
import { formatDate, fullDateTime } from '../lib/format';
import {
  SECTION_KEYS,
  SECTION_LABEL,
  STATUS_LABEL,
  getIdea,
  type Idea,
  type Sections,
} from '../features/ideas/api';
import { partnerName, useLookups } from '../features/ideas/useLookups';
import {
  ITEM_TYPE_LABEL,
  QUESTION_STATUS_LABEL,
  listIdeaItems,
  type Item,
} from '../features/items/api';
import { listResources, type ResourceRow } from '../features/resources/api';
import { listDecisions, type Decision } from '../features/decisions/api';

interface PrintData {
  idea: Idea;
  sections: Sections;
  items: Item[];
  resources: ResourceRow[];
  decisions: Decision[];
}

async function loadAll(id: string): Promise<PrintData | null> {
  const [found, items, resources, decisions] = await Promise.all([
    getIdea(id),
    listIdeaItems(id),
    listResources(id),
    listDecisions(id),
  ]);
  return found ? { ...found, items, resources, decisions } : null;
}

/**
 * Clean print page for one idea (spec section 10): description, sections, questions, decisions and
 * resources. The browser's print dialog saves it as PDF (Hebrew PDF generation for free).
 */
export function IdeaPrintRoute() {
  const { id = '' } = useParams();
  const lookups = useLookups();
  const [data, setData] = useState<PrintData | null | 'notFound'>(null);
  const [error, setError] = useState<MessageKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadAll(id).then(
      (result) => {
        if (!cancelled) setData(result ?? 'notFound');
      },
      (cause: unknown) => {
        if (!cancelled) setError(errorMessageKey(cause));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id]);

  // The idea's title names the saved PDF.
  useEffect(() => {
    if (data && data !== 'notFound') {
      const previous = document.title;
      document.title = data.idea.title;
      return () => {
        document.title = previous;
      };
    }
  }, [data]);

  if (error)
    return (
      <p role="alert" className="p-8 text-red-700">
        {t(error)}
      </p>
    );
  if (!data)
    return (
      <p role="status" className="p-8 text-slate-500">
        {t('common.loading')}
      </p>
    );
  if (data === 'notFound')
    return <p className="p-8 text-slate-700">{t('errors.idea_not_found')}</p>;

  const { idea, sections, items, resources, decisions } = data;
  const category = lookups?.categories.find((c) => c.id === idea.category_id);
  const questions = items.filter((item) => item.type === 'question');
  const thinking = items.filter((item) => item.type !== 'question');
  const name = (userId: string | null) => partnerName(lookups, userId);

  return (
    <article className="mx-auto max-w-3xl bg-white px-6 py-8 text-slate-900 print:max-w-none print:p-0">
      <div className="mb-6 flex flex-wrap gap-3 print:hidden">
        <button type="button" className="btn-primary" onClick={() => window.print()}>
          {t('print.button')}
        </button>
        <Link to={`/ideas/${idea.id}`} className="btn-secondary">
          {t('print.back')}
        </Link>
      </div>

      <header className="border-b border-slate-300 pb-4">
        <h1 className="text-3xl font-bold" data-user-content>
          {idea.title}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {t(STATUS_LABEL[idea.status])}
          {category && ` · ${category.name}`}
          {` · ${t('idea.versionBadge', { n: idea.version_no })}`}
        </p>
        <p className="text-sm text-slate-600">
          {name(idea.created_by)} · {fullDateTime(idea.created_at)} · {t('csv.updated')}{' '}
          {fullDateTime(idea.updated_at)}
        </p>
        {(idea.next_step || idea.owner_id || idea.next_step_due) && (
          <p className="mt-2 text-sm">
            {idea.next_step && (
              <span data-user-content>{t('home.nextStep', { text: idea.next_step })}</span>
            )}
            {idea.owner_id && ` · ${t('decisions.assignee', { name: name(idea.owner_id) })}`}
            {idea.next_step_due &&
              ` · ${t('decisions.due', { date: formatDate(idea.next_step_due) })}`}
          </p>
        )}
      </header>

      <section className="mt-6 break-inside-avoid">
        <h2 className="text-xl font-bold">{t('idea.currentTitle')}</h2>
        <p className="mt-2 whitespace-pre-wrap" data-user-content>
          {idea.summary}
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-bold">{t('idea.developmentTitle')}</h2>
        {SECTION_KEYS.map((key) => (
          <div key={key} className="mt-3 break-inside-avoid">
            <h3 className="font-bold">{t(SECTION_LABEL[key])}</h3>
            <p className="whitespace-pre-wrap text-slate-800" data-user-content>
              {sections[key] || <span className="text-slate-400">{t('idea.emptySection')}</span>}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-bold">{t('print.questions')}</h2>
        {questions.length === 0 && <p className="text-slate-500">{t('print.noItems')}</p>}
        <ul className="mt-2 space-y-3">
          {questions.map((q) => (
            <li key={q.id} className="break-inside-avoid">
              <p className="font-medium" data-user-content>
                {q.content}
              </p>
              <p className="text-sm text-slate-600">
                {q.question_status && t(QUESTION_STATUS_LABEL[q.question_status])} ·{' '}
                {name(q.created_by)} · {fullDateTime(q.created_at)}
                {q.assignee_id && ` · ${t('decisions.assignee', { name: name(q.assignee_id) })}`}
              </p>
              {q.answer && (
                <p
                  className="mt-1 whitespace-pre-wrap border-s-4 border-emerald-500 ps-3"
                  data-user-content
                >
                  {q.answer}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-bold">{t('print.thinking')}</h2>
        {thinking.length === 0 && <p className="text-slate-500">{t('print.noItems')}</p>}
        <ul className="mt-2 space-y-3">
          {thinking.map((item) => (
            <li key={item.id} className="break-inside-avoid">
              <p className="text-sm text-slate-600">
                {t(ITEM_TYPE_LABEL[item.type])} · {name(item.created_by)} ·{' '}
                {fullDateTime(item.created_at)}
              </p>
              <p className="whitespace-pre-wrap" data-user-content>
                {item.content}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-bold">{t('decisions.title')}</h2>
        {decisions.length === 0 && <p className="text-slate-500">{t('print.noItems')}</p>}
        <ul className="mt-2 space-y-3">
          {decisions.map((decision) => (
            <li key={decision.id} className="break-inside-avoid">
              <p className="font-medium" data-user-content>
                {decision.content}
              </p>
              <p className="text-sm text-slate-600">
                {name(decision.created_by)} · {fullDateTime(decision.created_at)}
              </p>
              {decision.reason && (
                <p className="text-sm" data-user-content>
                  {t('decisions.reason', { text: decision.reason })}
                </p>
              )}
              {decision.basis && (
                <p className="text-sm" data-user-content>
                  {t('decisions.basis', { text: decision.basis })}
                </p>
              )}
              {decision.next_step && (
                <p className="text-sm" data-user-content>
                  {t('decisions.nextStep', { text: decision.next_step })}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-bold">{t('resources.title')}</h2>
        {resources.length === 0 && <p className="text-slate-500">{t('print.noItems')}</p>}
        <ul className="mt-2 space-y-3">
          {resources.map(({ resource, file }) => (
            <li key={resource.id} className="break-inside-avoid">
              <p className="font-medium" data-user-content>
                {resource.title || file?.original_name}
              </p>
              {resource.url && (
                <p className="text-sm break-all text-slate-600" dir="ltr">
                  {resource.url}
                </p>
              )}
              {file && (
                <p className="text-sm text-slate-600">
                  <bdi>{file.original_name}</bdi>
                </p>
              )}
              {resource.description && (
                <p className="text-sm" data-user-content>
                  {resource.description}
                </p>
              )}
              {resource.relevance && (
                <p className="text-sm" data-user-content>
                  {t('resources.relevance', { text: resource.relevance })}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-8 border-t border-slate-300 pt-3 text-xs text-slate-500">
        {t('print.printedAt', { date: fullDateTime(new Date().toISOString()) })}
      </footer>
    </article>
  );
}
