import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { t, type MessageKey } from '../../lib/i18n';
import { errorMessageKey } from '../../lib/supabase';
import type { Lookups } from '../ideas/useLookups';
import { listIdeaItems, type Item } from './api';
import { ItemComposer } from './ItemComposer';
import { ItemView } from './ItemView';

/**
 * The idea page's "open questions" and "shared thinking" areas (spec section 6). A question sits
 * under open questions until it is answered, then moves into the shared thinking feed.
 */
export function IdeaItems({ ideaId, lookups }: { ideaId: string; lookups: Lookups | null }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const location = useLocation();
  const highlightId = location.hash.startsWith('#item-') ? location.hash.slice(6) : null;

  useEffect(() => {
    let cancelled = false;
    listIdeaItems(ideaId).then(
      (list) => {
        if (!cancelled) setItems(list);
      },
      (cause: unknown) => {
        if (!cancelled) setError(errorMessageKey(cause));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [ideaId]);

  // Coming from the open questions screen: bring that question into view.
  useEffect(() => {
    if (items && highlightId) {
      document.getElementById(`item-${highlightId}`)?.scrollIntoView({ block: 'center' });
    }
  }, [items, highlightId]);

  const replace = (updated: Item) =>
    setItems((list) => list?.map((item) => (item.id === updated.id ? updated : item)) ?? null);
  const remove = (id: string) => setItems((list) => list?.filter((item) => item.id !== id) ?? null);

  const open = (items ?? []).filter(
    (item) => item.type === 'question' && item.question_status !== 'answered',
  );
  // Newest first; answered questions join the feed.
  const feed = (items ?? [])
    .filter((item) => item.type !== 'question' || item.question_status === 'answered')
    .slice()
    .reverse();

  const renderItem = (item: Item) => (
    <ItemView
      key={item.id}
      item={item}
      lookups={lookups}
      highlighted={item.id === highlightId}
      onChanged={replace}
      onDeleted={remove}
    />
  );

  return (
    <>
      <section className="card mt-6" aria-labelledby="idea-open-questions">
        <h2 id="idea-open-questions" className="text-lg font-bold text-slate-900">
          {t('items.openTitle')}
          {open.length > 0 && (
            <span className="ms-2 text-base text-amber-700">({open.length})</span>
          )}
        </h2>
        {items && open.length === 0 && (
          <p className="mt-3 text-sm text-slate-500">{t('items.noOpen')}</p>
        )}
        {open.length > 0 && <ul className="mt-4 space-y-3">{open.map(renderItem)}</ul>}
      </section>

      <section className="card mt-6" aria-labelledby="idea-feed">
        <h2 id="idea-feed" className="text-lg font-bold text-slate-900">
          {t('items.feedTitle')}
        </h2>
        <div className="mt-4">
          <ItemComposer
            ideaId={ideaId}
            onAdded={(item) => setItems((list) => [...(list ?? []), item])}
          />
        </div>
        {error && (
          <p role="alert" className="mt-4 text-sm font-medium text-red-700">
            {t(error)}
          </p>
        )}
        {!items && !error && (
          <p role="status" className="mt-4 text-slate-500">
            {t('common.loading')}
          </p>
        )}
        {items && feed.length === 0 && (
          <p className="mt-4 text-sm text-slate-500">{t('items.feedEmpty')}</p>
        )}
        {feed.length > 0 && <ul className="mt-6 space-y-3">{feed.map(renderItem)}</ul>}
      </section>
    </>
  );
}
