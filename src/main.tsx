import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { t } from './lib/i18n';
import { PlaceholderRoute } from './routes/PlaceholderRoute';

document.title = t('app.name');

const root = document.getElementById('root');
if (!root) {
  throw new Error('root_element_missing');
}

createRoot(root).render(
  <StrictMode>
    <PlaceholderRoute />
  </StrictMode>,
);
