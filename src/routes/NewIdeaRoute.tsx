import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { t, type MessageKey } from '../lib/i18n';
import { errorMessageKey } from '../lib/supabase';
import { createIdea } from '../features/ideas/api';
import { useLookups } from '../features/ideas/useLookups';

/**
 * Create an idea (spec section 6): two required fields, two optional ones, then straight to the
 * idea page. Acceptance criterion 2: under a minute.
 */
export function NewIdeaRoute() {
  const navigate = useNavigate();
  const lookups = useLookups();
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [interesting, setInteresting] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return setError('errors.title_required');
    if (!summary.trim()) return setError('errors.summary_required');
    setSaving(true);
    setError(null);
    try {
      const id = await createIdea({
        title: title.trim(),
        summary: summary.trim(),
        categoryId: categoryId || null,
        interesting: interesting.trim(),
      });
      navigate(`/ideas/${id}`);
    } catch (cause) {
      // The form keeps everything that was typed (hard rule 6).
      setError(errorMessageKey(cause));
      setSaving(false);
    }
  }

  return (
    <section className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">{t('nav.newIdea')}</h1>
      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
        <div>
          <label htmlFor="new-title" className="field-label">
            {t('idea.titleLabel')}
          </label>
          <input
            id="new-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
            required
            maxLength={200}
            className="field-input mt-1"
            data-user-content
          />
        </div>
        <div>
          <label htmlFor="new-summary" className="field-label">
            {t('idea.summaryLabel')}
          </label>
          <textarea
            id="new-summary"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            required
            rows={3}
            className="field-input mt-1 py-2"
          />
        </div>
        <div>
          <label htmlFor="new-interesting" className="field-label">
            {t('idea.interestingLabel')}{' '}
            <span className="font-normal text-slate-500">{t('common.optional')}</span>
          </label>
          <textarea
            id="new-interesting"
            value={interesting}
            onChange={(event) => setInteresting(event.target.value)}
            rows={3}
            className="field-input mt-1 py-2"
          />
        </div>
        <div>
          <label htmlFor="new-category" className="field-label">
            {t('idea.categoryLabel')}{' '}
            <span className="font-normal text-slate-500">{t('common.optional')}</span>
          </label>
          <select
            id="new-category"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="field-input mt-1"
          >
            <option value="">{t('idea.noCategory')}</option>
            {lookups?.categories
              .filter((category) => category.is_active)
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
          </select>
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {t(error)}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? t('idea.creating') : t('idea.create')}
          </button>
          <Link to="/" className="btn-secondary">
            {t('common.cancel')}
          </Link>
        </div>
      </form>
    </section>
  );
}
