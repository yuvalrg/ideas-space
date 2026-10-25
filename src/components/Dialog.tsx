import { useEffect, useId, useRef, type ReactNode } from 'react';

/**
 * Modal dialog on the native <dialog> element: focus trap, Escape and the backdrop come from the
 * browser, and its layout follows the document's RTL direction.
 */
export function Dialog({
  open,
  title,
  onClose,
  children,
  actions,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl bg-white p-6 text-slate-800 shadow-xl backdrop:bg-slate-900/40"
    >
      <h2 id={titleId} className="text-xl font-bold text-slate-900">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
      <div className="mt-6 flex flex-wrap justify-end gap-3">{actions}</div>
    </dialog>
  );
}
