import { Link } from 'react-router';
import { t } from '../../lib/i18n';
import { Message } from '../../lib/i18n/Message';
import { formatDate, isPastDue } from '../../lib/format';
import { TimeAgo } from '../../components/TimeAgo';
import type { Category, Idea } from './api';
import { CategoryChip, NewMark, StatusBadge } from './badges';

export interface IdeaSummary {
  idea: Idea;
  category: Category | undefined;
  creatorName: string;
  openQuestions: number;
  isNew: boolean;
}

function NextStep({ idea }: { idea: Idea }) {
  if (!idea.next_step && !idea.next_step_due) return null;
  const overdue = isPastDue(idea.next_step_due);
  return (
    <p className="text-sm text-slate-700">
      {idea.next_step && (
        <span data-user-content>{t('home.nextStep', { text: idea.next_step })}</span>
      )}
      {idea.next_step_due && (
        <span
          className={`ms-2 whitespace-nowrap ${overdue ? 'font-medium text-red-700' : 'text-slate-500'}`}
        >
          {t('home.due', { date: formatDate(idea.next_step_due) })}
          {overdue && ` (${t('home.overdue')})`}
        </span>
      )}
    </p>
  );
}

/** Card view (spec section 6): name, short description, category, status, creator, updated,
 * open questions, next step, and the "new since last visit" mark. */
export function IdeaCard({ item }: { item: IdeaSummary }) {
  const { idea } = item;
  return (
    <Link
      to={`/ideas/${idea.id}`}
      className="card flex h-full flex-col gap-3 transition hover:border-blue-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-blue-600"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900" data-user-content>
          {idea.title}
        </h2>
        {item.isNew && <NewMark />}
      </div>
      <p className="line-clamp-3 text-slate-600" data-user-content>
        {idea.summary}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={idea.status} />
        <CategoryChip category={item.category} />
      </div>
      <NextStep idea={idea} />
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span>
          {item.creatorName && (
            <>
              <bdi>{item.creatorName}</bdi>
              {' · '}
            </>
          )}
          <Message id="home.updated" values={{ time: <TimeAgo iso={idea.updated_at} /> }} />
        </span>
        {item.openQuestions > 0 && (
          <span className="font-medium text-amber-700">
            {t('home.openQuestions', { count: item.openQuestions })}
          </span>
        )}
      </div>
    </Link>
  );
}

/** List view: one compact row per idea. */
export function IdeaRow({ item }: { item: IdeaSummary }) {
  const { idea } = item;
  return (
    <Link
      to={`/ideas/${idea.id}`}
      className="grid gap-2 px-4 py-3 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 md:grid-cols-[minmax(0,3fr)_8rem_minmax(0,1.5fr)_8rem_6rem] md:items-center"
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate font-medium text-slate-900" data-user-content>
          {idea.title}
        </span>
        {item.isNew && <NewMark />}
      </span>
      <span>
        <StatusBadge status={idea.status} />
      </span>
      <span className="min-w-0 truncate">
        <CategoryChip category={item.category} />
      </span>
      <span className="text-sm text-slate-500">
        <TimeAgo iso={idea.updated_at} />
      </span>
      <span className="text-sm text-slate-600">
        {item.openQuestions > 0 ? item.openQuestions : ''}
        {item.openQuestions > 0 && <span className="md:sr-only"> {t('home.colQuestions')}</span>}
      </span>
    </Link>
  );
}
