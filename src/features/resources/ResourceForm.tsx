import { useId, useRef, useState, type FormEvent } from 'react';
import { t, type MessageKey } from '../../lib/i18n';
import { Message } from '../../lib/i18n/Message';
import { errorMessageKey } from '../../lib/supabase';
import { addFile, addLink } from './api';
import { ACCEPT, formatSize, validateFile } from './upload';

type Kind = 'link' | 'file';

/**
 * Resource form (spec section 6): one required field (a link or a file); name, description and
 * "what we learn from it" are optional. On a phone, "take photo" opens the camera directly.
 */
export function ResourceForm({ ideaId, onAdded }: { ideaId: string; onAdded: () => void }) {
  const id = useId();
  const [kind, setKind] = useState<Kind>('link');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [relevance, setRelevance] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  function pick(chosen: File | undefined) {
    if (!chosen) return;
    const problem = validateFile(chosen);
    setError(problem);
    setFile(problem ? null : chosen);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const details = { title, description, relevance };
    if (kind === 'link') {
      const trimmed = url.trim();
      if (!trimmed) return setError('resources.urlRequired');
      if (!/^https?:\/\/\S+$/i.test(trimmed)) return setError('resources.urlInvalid');
    } else if (!file) {
      return setError('resources.fileRequired');
    }
    setSaving(true);
    setError(null);
    try {
      if (kind === 'link') await addLink(ideaId, url.trim(), details);
      else if (file) await addFile(ideaId, file, details);
      setUrl('');
      setFile(null);
      setTitle('');
      setDescription('');
      setRelevance('');
      onAdded();
    } catch (cause) {
      // Everything typed and the chosen file stay in the form (hard rule 6).
      setError(errorMessageKey(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <fieldset>
        <legend className="field-label">{t('resources.kindLabel')}</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {(['link', 'file'] as const).map((option) => (
            <label
              key={option}
              className={`flex min-h-11 cursor-pointer items-center rounded-lg border px-4 text-sm font-medium ${
                kind === option
                  ? 'border-blue-600 bg-blue-50 text-blue-800'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name={`${id}-kind`}
                value={option}
                checked={kind === option}
                onChange={() => {
                  setKind(option);
                  setError(null);
                }}
                className="sr-only"
              />
              {t(option === 'link' ? 'resources.kindLink' : 'resources.kindFile')}
            </label>
          ))}
        </div>
      </fieldset>

      {kind === 'link' ? (
        <div>
          <label htmlFor={`${id}-url`} className="field-label">
            {t('resources.urlLabel')}
          </label>
          <input
            id={`${id}-url`}
            type="url"
            dir="ltr"
            inputMode="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://"
            className="field-input mt-1"
          />
          <p className="mt-1 text-xs text-slate-500">{t('resources.urlHint')}</p>
        </div>
      ) : (
        <div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => fileInput.current?.click()}
            >
              {t('resources.chooseFile')}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => cameraInput.current?.click()}
            >
              {t('resources.takePhoto')}
            </button>
          </div>
          {/* Hidden inputs: the second opens the phone camera directly (spec section 9). */}
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              pick(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              pick(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <p className="mt-2 text-sm text-slate-600" aria-live="polite">
            {file ? (
              <Message
                id="resources.fileChosen"
                values={{ name: <bdi>{file.name}</bdi>, size: formatSize(file.size) }}
              />
            ) : (
              <span className="text-xs text-slate-500">{t('resources.fileHint')}</span>
            )}
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor={`${id}-title`} className="field-label">
            {t('resources.nameLabel')}{' '}
            <span className="font-normal text-slate-500">{t('common.optional')}</span>
          </label>
          <input
            id={`${id}-title`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            className="field-input mt-1"
          />
          <p className="mt-1 text-xs text-slate-500">{t('resources.nameHint')}</p>
        </div>
        <div>
          <label htmlFor={`${id}-description`} className="field-label">
            {t('resources.descriptionLabel')}{' '}
            <span className="font-normal text-slate-500">{t('common.optional')}</span>
          </label>
          <input
            id={`${id}-description`}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="field-input mt-1"
          />
        </div>
      </div>
      <div>
        <label htmlFor={`${id}-relevance`} className="field-label">
          {t('resources.relevanceLabel')}{' '}
          <span className="font-normal text-slate-500">{t('common.optional')}</span>
        </label>
        <textarea
          id={`${id}-relevance`}
          value={relevance}
          onChange={(event) => setRelevance(event.target.value)}
          rows={2}
          className="field-input mt-1 py-2"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving
            ? t(kind === 'file' ? 'resources.uploading' : 'resources.adding')
            : t('resources.add')}
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
