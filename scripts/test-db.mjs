// Database tests: runs every supabase/tests/*.sql pgTAP file and fails on any "not ok".
//
// Offline (default, `npm run test:db`): applies supabase/migrations and supabase/seed.sql to PGlite
// (Postgres in WASM) on top of a minimal Supabase stand-in. Needs no Docker and no network, so it
// works where Postgres ports are blocked.
//
// Remote (`npm run test:db:remote`): runs the same files against the database in SUPABASE_DB_URL
// (the dev project's session pooler connection string), after `npm run db:push`. Each test file
// rolls back, so it leaves no data behind.

import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const remote = process.argv.includes('--remote');

async function sqlFiles(dir) {
  const names = (await readdir(dir)).filter((name) => name.endsWith('.sql')).sort();
  return names.map((name) => join(dir, name));
}

// Returns an object with exec(sql) -> array of row arrays (one per statement), and close().
async function connect() {
  if (remote) {
    const url = process.env.SUPABASE_DB_URL;
    if (!url) {
      console.error('Set SUPABASE_DB_URL to the dev project connection string (never commit it).');
      process.exit(1);
    }
    const { default: pg } = await import('pg');
    const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    await client.connect();
    return {
      async exec(sql) {
        const result = await client.query(sql);
        return (Array.isArray(result) ? result : [result]).map((r) => r.rows ?? []);
      },
      close: () => client.end(),
    };
  }

  const { PGlite } = await import('@electric-sql/pglite');
  const { pg_trgm } = await import('@electric-sql/pglite/contrib/pg_trgm');
  const { pgtap } = await import('@electric-sql/pglite-pgtap');
  const db = await PGlite.create({ extensions: { pg_trgm, pgtap } });
  return {
    async exec(sql) {
      return (await db.exec(sql)).map((r) => r.rows);
    },
    close: () => db.close(),
  };
}

const db = await connect();

if (!remote) {
  const setup = [
    join(root, 'scripts', 'db-offline', 'supabase-shim.sql'),
    ...(await sqlFiles(join(root, 'supabase', 'migrations'))),
    join(root, 'supabase', 'seed.sql'),
  ];
  for (const file of setup) {
    try {
      await db.exec(await readFile(file, 'utf8'));
    } catch (error) {
      console.error(`setup failed in ${relative(root, file)}: ${error.message}`);
      if (error.where) console.error(error.where);
      process.exit(1);
    }
  }
  console.log(`# offline setup ok: ${setup.length} files applied`);
} else {
  console.log('# remote: testing the database in SUPABASE_DB_URL');
}

let failures = 0;
let assertions = 0;

for (const file of await sqlFiles(join(root, 'supabase', 'tests'))) {
  console.log(`\n# ${relative(root, file)}`);
  let results;
  try {
    results = await db.exec(await readFile(file, 'utf8'));
  } catch (error) {
    failures += 1;
    console.log(`not ok - aborted: ${error.message}`);
    if (error.where) console.log(`# ${error.where}`);
    await db.exec('rollback').catch(() => {});
    continue;
  }
  for (const rows of results) {
    for (const row of rows) {
      const value = Object.values(row)[0];
      if (typeof value !== 'string') continue;
      for (const line of value.split('\n')) {
        // Print TAP output only, not the results of fixture statements.
        if (/^(ok |not ok |#|\d+\.\.\d+)/.test(line)) console.log(line);
        if (/^ok \d+/.test(line)) assertions += 1;
        if (/^not ok \d+/.test(line)) {
          assertions += 1;
          failures += 1;
        }
        if (/^# Looks like you planned/.test(line)) failures += 1;
      }
    }
  }
}

await db.close();
console.log(`\n# ${assertions} assertions, ${failures} failures`);
process.exit(failures === 0 && assertions > 0 ? 0 : 1);
