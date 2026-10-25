import { useId, useState, type FormEvent } from 'react';
import { t, type MessageKey } from '../../lib/i18n';
import { errorMessageKey } from '../../lib/supabase';
import { ITEM_TYPES, ITEM_TYPE_LABEL, addItem, type Item, type ItemType } from './api';

const PLACEHOLDER: Record<ItemType, MessageKey> = {
  thought: 'items.placeholderThought',
  question: 'items.placeholderQuestion',
  info: 'items.placeholderInfo',
};

/** Add a thought, question or info to an idea, inside the idea page (spec section 6). */
export function ItemComposer({
  ideaId,
  onAdded,
}: {
  ideaId: string;
  onAdded: (item: Item) => void;
}) {
  const [type, setType] = useState<ItemType>('thought');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const groupId = useId();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content.trim()) return setError('items.contentRequired');
    setSaving(true);
    setError(null);
    try {
      const item = await addItem(ideaId, type, content.trim());
      setContent('');
      onAdded(item);
    } catch (cause) {
      // The text stays in the box (hard rule 6).
      setError(errorMessageKey(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <fieldset>
        <legend id={groupId} className="field-label">
          {t('items.typeLabel')}
        </legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {ITEM_TYPES.map((option) => (
            <label
              key={option}
              className={`flex min-h-11 cursor-pointer items-center rounded-lg border px-4 text-sm font-medium ${
                type === option
                  ? 'border-blue-600 bg-blue-50 text-blue-800'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name={`${groupId}-type`}
                value={option}
                checked={type === option}
                onChange={() => setType(option)}
                className="sr-only"
              />
              {t(ITEM_TYPE_LABEL[option])}
            </label>
          ))}
        </div>
      </fieldset>
      <label htmlFor={`${groupId}-content`} className="sr-only">
        {t('items.contentLabel')}
      </label>
      <textarea
        id={`${groupId}-content`}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder={t(PLACEHOLDER[type])}
        rows={3}
        className="field-input py-2"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? t('items.adding') : t('items.add')}
        </button>
        {error && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {t(error)}
          </p>
        )}
      </div>
    </form>
  );
}
