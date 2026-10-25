import { t } from '../../lib/i18n';
import { STATUS_LABEL, type Category, type IdeaStatus } from './api';

const STATUS_STYLE: Record<IdeaStatus, string> = {
  new: 'bg-sky-50 text-sky-800 ring-sky-200',
  discussion: 'bg-violet-50 text-violet-800 ring-violet-200',
  review: 'bg-amber-50 text-amber-800 ring-amber-200',
  approved: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  paused: 'bg-slate-100 text-slate-700 ring-slate-200',
  dropped: 'bg-rose-50 text-rose-800 ring-rose-200',
};

export function StatusBadge({ status }: { status: IdeaStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLE[status]}`}
    >
      {t(STATUS_LABEL[status])}
    </span>
  );
}

export function CategoryChip({ category }: { category: Category | undefined }) {
  if (!category) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
      <span
        aria-hidden="true"
        className="size-2.5 rounded-full"
        style={{ backgroundColor: category.color ?? '#94a3b8' }}
      />
      {category.name}
    </span>
  );
}

export function NewMark() {
  return (
    <span
      title={t('home.newMarkLabel')}
      className="inline-flex items-center rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white"
    >
      {t('home.newMark')}
      <span className="sr-only">: {t('home.newMarkLabel')}</span>
    </span>
  );
}
