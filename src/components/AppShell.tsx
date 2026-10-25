import { useEffect, useId, useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { t, type MessageKey } from '../lib/i18n';
import { getSupabase } from '../lib/supabase';
import { useAuth } from '../features/auth/authContext';
import { CloseIcon, MenuIcon } from './icons';

const NAV_ITEMS: { to: string; label: MessageKey }[] = [
  { to: '/', label: 'nav.home' },
  { to: '/ideas/new', label: 'nav.newIdea' },
  { to: '/questions', label: 'nav.openQuestions' },
  { to: '/activity', label: 'nav.activity' },
  { to: '/trash', label: 'nav.trash' },
  { to: '/settings', label: 'nav.settings' },
];

/** The workspace name from app_settings, falling back to the app name. */
function useWorkspaceName(): string {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    getSupabase()
      .from('app_settings')
      .select('value')
      .eq('key', 'workspace_name')
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setName(data.value);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return name ?? t('app.name');
}

/**
 * Signed-in layout (spec section 6): the menu sits on the inline-start side (right, in RTL).
 * Below 768px it collapses behind a menu button on the same side and opens as a drawer.
 */
export function AppShell() {
  const { profile, signOut } = useAuth();
  const workspaceName = useWorkspaceName();
  const [menuOpen, setMenuOpen] = useState(false);
  const drawerId = useId();

  // Close the drawer on Escape (links close it on click).
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const nav = (
    <nav aria-label={t('nav.mainLabel')} className="flex h-full flex-col">
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `flex min-h-11 items-center rounded-lg px-3 font-medium ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-100'
                }`
              }
            >
              {t(item.label)}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="mt-auto border-t border-slate-200 pt-4">
        <p className="truncate px-3 text-sm text-slate-500" data-user-content>
          {profile?.display_name}
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-2 flex min-h-11 w-full items-center rounded-lg px-3 text-start font-medium text-slate-700 hover:bg-slate-100"
        >
          {t('nav.signOut')}
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      {/* Mobile top bar: the menu button is at inline-start (right). */}
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-slate-200 bg-white px-2 py-2 md:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label={t('nav.openMenu')}
          aria-expanded={menuOpen}
          aria-controls={drawerId}
          className="flex size-11 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
        >
          <MenuIcon />
        </button>
        <span className="truncate font-bold text-slate-900">{workspaceName}</span>
      </header>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div
            id={drawerId}
            role="dialog"
            aria-modal="true"
            aria-label={t('nav.mainLabel')}
            className="absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col bg-white p-4 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <span className="truncate font-bold text-slate-900">{workspaceName}</span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label={t('nav.closeMenu')}
                autoFocus
                className="flex size-11 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
              >
                <CloseIcon />
              </button>
            </div>
            {nav}
          </div>
        </div>
      )}

      {/* Desktop side menu at inline-start */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-e border-slate-200 bg-white p-4 md:flex">
        <p className="mb-6 px-3 text-lg font-bold text-slate-900">{workspaceName}</p>
        {nav}
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-10">
        <Outlet />
      </main>
    </div>
  );
}
