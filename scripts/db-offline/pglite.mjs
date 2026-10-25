// A fresh offline database (PGlite, Postgres in WASM) shaped like the Supabase project: the small
// Supabase stand-in, every migration, and optionally the seed. Used by test-db and import --offline.

import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export async function sqlFiles(dir) {
  const names = (await readdir(dir)).filter((name) => name.endsWith('.sql')).sort();
  return names.map((name) => join(dir, name));
}

export async function createOfflineDb({ seed = true } = {}) {
  const { PGlite } = await import('@electric-sql/pglite');
  const { pg_trgm } = await import('@electric-sql/pglite/contrib/pg_trgm');
  const { pgtap } = await import('@electric-sql/pglite-pgtap');
  const db = await PGlite.create({ extensions: { pg_trgm, pgtap } });

  const setup = [
    join(root, 'scripts', 'db-offline', 'supabase-shim.sql'),
    ...(await sqlFiles(join(root, 'supabase', 'migrations'))),
    ...(seed ? [join(root, 'supabase', 'seed.sql')] : []),
  ];
  for (const file of setup) {
    try {
      await db.exec(await readFile(file, 'utf8'));
    } catch (error) {
      throw new Error(`setup failed in ${relative(root, file)}: ${error.message}`);
    }
  }
  return { db, setupCount: setup.length };
}
