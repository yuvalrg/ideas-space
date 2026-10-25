import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { t, type MessageKey } from '../lib/i18n';
import { errorMessageKey, getSupabase } from '../lib/supabase';
import { useAuth } from '../features/auth/authContext';
import {
  IDEA_STATUSES,
  STATUS_LABEL,
  listIdeas,
  openQuestionCounts,
  searchIdeaIds,
  type Idea,
} from '../features/ideas/api';
import { IdeaCard, IdeaRow, type IdeaSummary } from '../features/ideas/IdeaCard';
import { partnerName, useLookups } from '../features/ideas/useLookups';

type SortKey = 'updated' | 'created' | 'title' | 'status';
type View = 'cards' | 'list';

const SORTS: { key: SortKey; label: MessageKey }[] = [
  { key: 'updated', label: 'home.sortUpdated' },
  { key: 'created', label: 'home.sortCreated' },
  { key: 'title', label: 'home.sortTitle' },
  { key: 'status', label: 'home.sortStatus' },
];

const VIEW_KEY = 'ideas-space:home-view';

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'cards';
  } catch {
    return 'cards';
  }
}

function saveView(view: View): void {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    // a per-viewer convenience only
  }
}

// last_seen_at from before this page load: ideas updated by others after it get the "new" mark.
// Captured once, so coming back to the home screen in the same visit keeps the marks.
let visitBaseline: string | null | undefined;

function compare(sort: SortKey, a: Idea, b: Idea): number {
  switch (sort) {
    case 'created':
      return b.created_at.localeCompare(a.created_at);
    case 'title':
      return a.title.localeCompare(b.title, 'he');
    case 'status':
      return (
        IDEA_STATUSES.indexOf(a.status) - IDEA_STATUSES.indexOf(b.status) ||
        b.updated_at.localeCompare(a.updated_at)
      );
    default:
      return b.updated_at.localeCompare(a.updated_at);
  }
}

/** Home screen (spec section 6): every idea, with search, filters, sort and two views. */
export function HomeRoute() {
  const { profile } = useAuth();
  const lookups = useLookups();
  const [params, setParams] = useSearchParams();
  // e.g. "moved to the trash", passed by the idea page when it navigates here
  const notice = (useLocation().state as { notice?: string } | null)?.notice;
  const query = (params.get('q') ?? '').trim();
  const statusFilter = params.get('status') ?? 'active';
  const categoryFilter = params.get('category') ?? '';
  const sort = (params.get('sort') as SortKey | null) ?? 'updated';

  const [view, setView] = useState<View>(readView);
  const [searchText, setSearchText] = useState(params.get('q') ?? '');
  const [data, setData] = useState<{ ideas: Idea[]; counts: Map<string, number> } | null>(null);
  const [search, setSearch] = useState<{ query: string; ids: Set<string> } | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const [baseline] = useState(() => {
    if (visitBaseline === undefined) visitBaseline = profile?.last_seen_at ?? null;
    return visitBaseline;
  });

  // Load the ideas, and record this visit for the next "new" marks.
  useEffect(() => {
    let cancelled = false;
    Promise.all([listIdeas(), openQuestionCounts()]).then(
      ([ideas, counts]) => {
        if (!cancelled) setData({ ideas, counts });
      },
      (cause: unknown) => {
        if (!cancelled) setError(errorMessageKey(cause));
      },
    );
    void getSupabase().rpc('touch_last_seen');
    return () => {
      cancelled = true;
    };
  }, []);

  // Typing updates the URL after a short pause; the URL drives the search. Only when the text
  // changed: replacing the URL also drops navigation state (e.g. the "moved to trash" notice).
  const urlQuery = params.get('q') ?? '';
  useEffect(() => {
    if (searchText.trim() === urlQuery.trim()) return;
    const timer = setTimeout(() => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (searchText.trim()) next.set('q', searchText);
          else next.delete('q');
          return next;
        },
        { replace: true },
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText, urlQuery, setParams]);

  useEffect(() => {
    if (!query) return;
    let cancelled = false;
    searchIdeaIds(query).then(
      (ids) => {
        if (!cancelled) setSearch({ query, ids });
      },
      (cause: unknown) => {
        if (!cancelled) setError(errorMessageKey(cause));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [query]);

  function setParam(name: string, value: string, fallback: string) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value === fallback) next.delete(name);
        else next.set(name, value);
        return next;
      },
      { replace: true },
    );
  }

  const matches = query ? (search?.query === query ? search.ids : null) : undefined;

  const items: IdeaSummary[] = useMemo(() => {
    if (!data) return [];
    const categories = new Map(lookups?.categories.map((c) => [c.id, c]));
    const since = baseline ? Date.parse(baseline) : null;
    return data.ideas
      .filter((idea) => {
        if (statusFilter === 'active' && (idea.status === 'paused' || idea.status === 'dropped')) {
          return false;
        }
        if (statusFilter !== 'active' && statusFilter !== 'all' && idea.status !== statusFilter) {
          return false;
        }
        if (categoryFilter && idea.category_id !== categoryFilter) return false;
        if (matches === null) return false; // search still running
        if (matches && !matches.has(idea.id)) return false;
        return true;
      })
      .sort((a, b) => compare(sort, a, b))
      .map((idea) => ({
        idea,
        category: idea.category_id ? categories.get(idea.category_id) : undefined,
        creatorName: partnerName(lookups, idea.created_by),
        openQuestions: data.counts.get(idea.id) ?? 0,
        isNew:
          since !== null && Date.parse(idea.updated_at) > since && idea.updated_by !== profile?.id,
      }));
  }, [data, lookups, baseline, statusFilter, categoryFilter, matches, sort, profile?.id]);

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">{t('home.title')}</h1>
        <Link to="/ideas/new" className="btn-primary">
          {t('nav.newIdea')}
        </Link>
      </div>
      {notice && (
        <p role="status" className="mt-4 text-sm font-medium text-emerald-700">
          {notice}{' '}
          <Link to="/trash" className="underline">
            {t('nav.trash')}
          </Link>
        </p>
      )}

      {data && data.ideas.length === 0 ? (
        <div className="card mt-8 text-center">
          <h2 className="text-lg font-bold text-slate-900">{t('home.emptyTitle')}</h2>
          <p className="mt-2 text-slate-600">{t('home.emptyText')}</p>
          <Link to="/ideas/new" className="btn-primary mt-5">
            {t('home.emptyAction')}
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto]">
            <div className="sm:col-span-2 lg:col-span-1">
              <label htmlFor="home-search" className="field-label">
                {t('home.searchLabel')}
              </label>
              <input
                id="home-search"
                type="search"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder={t('home.searchPlaceholder')}
                className="field-input mt-1"
              />
            </div>
            <div>
              <label htmlFor="home-status" className="field-label">
                {t('home.statusFilter')}
              </label>
              <select
                id="home-status"
                value={statusFilter}
                onChange={(event) => setParam('status', event.target.value, 'active')}
                className="field-input mt-1"
              >
                <option value="active">{t('home.statusActive')}</option>
                <option value="all">{t('home.statusAll')}</option>
                {IDEA_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {t(STATUS_LABEL[status])}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="home-category" className="field-label">
                {t('home.categoryFilter')}
              </label>
              <select
                id="home-category"
                value={categoryFilter}
                onChange={(event) => setParam('category', event.target.value, '')}
                className="field-input mt-1"
              >
                <option value="">{t('home.categoryAll')}</option>
                {lookups?.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="home-sort" className="field-label">
                {t('home.sort')}
              </label>
              <select
                id="home-sort"
                value={sort}
                onChange={(event) => setParam('sort', event.target.value, 'updated')}
                className="field-input mt-1"
              >
                {SORTS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {t(option.label)}
                  </option>
                ))}
              </select>
            </div>
            <div role="group" aria-label={t('home.viewLabel')} className="flex items-end gap-1">
              {(['cards', 'list'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={view === option}
                  onClick={() => {
                    setView(option);
                    saveView(option);
                  }}
                  className={`min-h-11 rounded-lg px-3 text-sm font-medium ${
                    view === option
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {t(option === 'cards' ? 'home.viewCards' : 'home.viewList')}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-6 font-medium text-red-700">
              {t(error)}
            </p>
          )}

          {!data || matches === null ? (
            <p role="status" className="mt-8 text-slate-500">
              {t('common.loading')}
            </p>
          ) : items.length === 0 ? (
            <p className="mt-8 text-slate-600">{t('home.noResults')}</p>
          ) : (
            <>
              <p className="mt-6 text-sm text-slate-500" aria-live="polite">
                {items.length === 1 ? t('home.countOne') : t('home.count', { count: items.length })}
              </p>
              {view === 'cards' ? (
                <ul className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map((item) => (
                    <li key={item.idea.id}>
                      <IdeaCard item={item} />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="card mt-3 overflow-hidden p-0">
                  <div className="hidden gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-500 md:grid md:grid-cols-[minmax(0,3fr)_8rem_minmax(0,1.5fr)_8rem_6rem]">
                    <span>{t('home.colTitle')}</span>
                    <span>{t('home.colStatus')}</span>
                    <span>{t('home.colCategory')}</span>
                    <span>{t('home.colUpdated')}</span>
                    <span>{t('home.colQuestions')}</span>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {items.map((item) => (
                      <li key={item.idea.id}>
                        <IdeaRow item={item} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
