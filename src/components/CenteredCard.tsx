import type { ReactNode } from 'react';

/** A single card in the middle of the page: login, welcome, no-access and error screens. */
export function CenteredCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <div className="mt-4">{children}</div>
      </div>
    </main>
  );
}

export function FullPageMessage({ text }: { text: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
      <p role="status">{text}</p>
    </main>
  );
}
