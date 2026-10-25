// Runs SQL on the linked Supabase project through `supabase db query --linked` (the CLI's own
// login; no database password, no Docker). Needs Postgres ports open (not on the office network).

import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { root } from './db-offline/pglite.mjs';

/** Runs a SQL text; returns stdout + stderr (the result is JSON on stdout). */
export async function runLinkedSql(sql, name = 'query.sql') {
  const work = await mkdtemp(join(tmpdir(), 'ideas-space-'));
  const file = join(work, name);
  await writeFile(file, sql, 'utf8');
  // One command string (the path is our own temp file); npx needs a shell on Windows.
  const run = spawnSync(`npx supabase db query --linked -f "${file}"`, {
    cwd: root,
    shell: true,
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
  });
  return { stdout: run.stdout ?? '', stderr: run.stderr ?? '', status: run.status };
}

/** Runs a query and returns its result rows (throws with the database error otherwise). */
export async function queryLinked(sql) {
  const { stdout, stderr } = await runLinkedSql(sql);
  const start = stdout.indexOf('{');
  if (start < 0) throw new Error((stderr || stdout).trim());
  const parsed = JSON.parse(stdout.slice(start));
  if (!Array.isArray(parsed.rows)) {
    const error = parsed.error?.message ?? JSON.stringify(parsed).slice(0, 500);
    throw new Error(error);
  }
  return parsed.rows;
}
