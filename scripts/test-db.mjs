// Database tests: runs every supabase/tests/*.sql pgTAP file and fails on any failed assertion.
//
// Offline (default, `npm run test:db`): applies supabase/migrations and supabase/seed.sql to PGlite
// (Postgres in WASM) on top of a minimal Supabase stand-in, then runs the tests. Needs no Docker and
// no network, so it works where Postgres ports are blocked.
//
// Remote (`npm run test:db:remote`): runs the same files against the linked dev project through
// `supabase db query --linked` (the CLI's own login, no database password). That command returns only
// the last statement's result, so each file ends by raising an exception that carries the pgTAP
// counts. The exception also guarantees the transaction rolls back: nothing is left behind.

import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createOfflineDb, root, sqlFiles } from './db-offline/pglite.mjs';
import { runLinkedSql } from './supabase-cli.mjs';

const remote = process.argv.includes('--remote');
const testFiles = await sqlFiles(join(root, 'supabase', 'tests'));
let failures = 0;
let assertions = 0;

if (remote) {
  console.log('# remote: testing the linked Supabase project');

  for (const file of testFiles) {
    const sql = (await readFile(file, 'utf8'))
      .replace(/^select \* from finish\(\);$/m, '')
      .replace(/^rollback;$/m, '');
    const wrapped = `${sql}
do $$ begin
  raise exception 'TAP_RESULT run=% failed=%',
    (select value from __tcache__ where label = 'curr_test'), num_failed();
end $$;
`;
    const run = await runLinkedSql(wrapped, file.split(/[\\/]/).pop());
    const output = `${run.stdout}\n${run.stderr}`;
    const match = output.match(/TAP_RESULT run=(\d+) failed=(\d+)/);

    if (!match) {
      failures += 1;
      const error = output.match(/ERROR:[^\\"]*/);
      console.log(`not ok - ${relative(root, file)} aborted: ${error ? error[0] : output.trim()}`);
      continue;
    }
    const [, ran, failed] = match.map(Number);
    assertions += ran;
    failures += failed;
    console.log(
      `${failed === 0 ? 'ok' : 'not ok'} - ${relative(root, file)}: ${ran} assertions, ${failed} failed`,
    );
  }
} else {
  let db;
  try {
    const created = await createOfflineDb();
    db = created.db;
    console.log(`# offline setup ok: ${created.setupCount} files applied`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  for (const file of testFiles) {
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
    for (const result of results) {
      for (const row of result.rows) {
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
}

console.log(`\n# ${assertions} assertions, ${failures} failures`);
process.exit(failures === 0 && assertions > 0 ? 0 : 1);
