import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import he from './src/lib/i18n/he.json';

/**
 * PWA manifest (spec section 12), built from he.json so its Hebrew name stays in the one
 * translation file (hard rule 2). Served by the dev server and emitted into the build.
 */
function manifestPlugin(): Plugin {
  const manifest = {
    name: he['app.name'],
    short_name: he['app.name'],
    description: he['app.tagline'],
    lang: 'he',
    dir: 'rtl',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#2563eb',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
  const json = JSON.stringify(manifest, null, 2);

  return {
    name: 'ideas-space-manifest',
    configureServer(server) {
      server.middlewares.use('/manifest.webmanifest', (_req, res) => {
        res.setHeader('Content-Type', 'application/manifest+json');
        res.end(json);
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: json });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), manifestPlugin()],
});
