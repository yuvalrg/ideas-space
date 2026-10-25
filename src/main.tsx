import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { t } from './lib/i18n';
import { isSupabaseConfigured } from './lib/supabase';
import { App } from './App';
import { CenteredCard } from './components/CenteredCard';

document.title = t('app.name');

const root = document.getElementById('root');
if (!root) {
  throw new Error('root_element_missing');
}

createRoot(root).render(
  <StrictMode>
    {isSupabaseConfigured ? (
      <App />
    ) : (
      <CenteredCard title={t('app.name')}>
        <p role="alert" className="text-red-700">
          {t('errors.missingSupabaseEnv')}
        </p>
      </CenteredCard>
    )}
  </StrictMode>,
);

// Minimal service worker for the installed app (spec section 12). Production builds only, so the
// dev server is never served from a cache.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
  });
}
