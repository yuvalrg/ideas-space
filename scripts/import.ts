// npm run import -- <export.json> --offline | --linked
//
// Loads a JSON export (spec section 10) into an empty project and compares row counts.
//   --offline  into a fresh local database (PGlite: migrations + seed), no network. The restore check.
//   --linked   into the Supabase project the CLI is linked to. Refused unless that project has no
//              ideas and no profiles yet (a fresh project: migrations, optionally the seed).
//
// Rows are inserted exactly as exported (ids, authors, times, activity). Triggers are paused for the
// load (session_replication_role = replica) so nothing is stamped or logged twice. Each partner also
// gets an auth user with the same id and email, so they sign in to the restored project as before.
// File contents are not part of the export; their records are.

import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  EXPORT_TABLES,
  isExportFile,
  rowCounts,
  type ExportFile,
} from '../src/features/export/format.ts';
import { createOfflineDb } from './db-offline/pglite.mjs';
import { queryLinked, runLinkedSql } from './supabase-cli.mjs';

const args = process.argv.slice(2);
const path = args.find((arg) => !arg.startsWith('--'));
const mode = args.includes('--linked') ? 'linked' : args.includes('--offline') ? 'offline' : null;

if (!path || !mode) {
  console.error('Usage: npm run import -- <export.json> --offline   (local check, no network)');
  console.error(
    '       npm run import -- <export.json> --linked    (into the linked, empty project)',
  );
  process.exit(1);
}

const file: unknown = JSON.parse(await readFile(path, 'utf8'));
if (!isExportFile(file)) {
  console.error(`${path} is not an ideas-space export (format/version/tables).`);
  process.exit(1);
}

/** A dollar-quote tag that does not occur in the data. */
function quoteTag(text: string): string {
  for (;;) {
    const tag = `$is_${randomBytes(6).toString('hex')}$`;
    if (!text.includes(tag)) return tag;
  }
}

function buildImportSql(data: ExportFile): string {
  const insert = (table: string, rows: unknown[]) => {
    const json = JSON.stringify(rows);
    const tag = quoteTag(json);
    return `insert into public.${table} select * from json_populate_recordset(null::public.${table}, ${tag}${json}${tag}::json);`;
  };
  const users = JSON.stringify(data.tables.profiles.map((p) => ({ id: p.id, email: p.email })));
  const usersTag = quoteTag(users);

  return `begin;
set local session_replication_role = replica;

do $guard$ begin
  if exists (select 1 from public.ideas) or exists (select 1 from public.profiles) then
    raise exception 'target_not_empty: the target project already has ideas or profiles';
  end if;
end $guard$;

-- A fresh project may hold the seed; the export replaces it.
delete from public.app_settings;
delete from public.categories;
delete from public.allowed_emails;

insert into auth.users (id, email)
  select (u->>'id')::uuid, u->>'email' from json_array_elements(${usersTag}${users}${usersTag}::json) u
  on conflict (id) do nothing;

${EXPORT_TABLES.map((table) => insert(table, data.tables[table])).join('\n')}

commit;
`;
}

const countSql = `select json_build_object(${EXPORT_TABLES.map(
  (table) => `'${table}', (select count(*) from public.${table})`,
).join(', ')}) as counts;`;

const expected = rowCounts(file);
const sql = buildImportSql(file);
let actual: Record<string, number>;

if (mode === 'offline') {
  const { db } = await createOfflineDb({ seed: true });
  await db.exec(sql);
  const result = await db.query<{ counts: Record<string, number> }>(countSql);
  actual = result.rows[0].counts;
  await db.close();
} else {
  const run = await runLinkedSql(sql, 'import.sql');
  const error = `${run.stdout}\n${run.stderr}`.match(/ERROR:[^\\"]*/);
  if (error) {
    console.error(error[0]);
    process.exit(1);
  }
  const rows = (await queryLinked(countSql)) as { counts: Record<string, number> }[];
  actual = rows[0].counts;
}

const report = EXPORT_TABLES.map((table) => ({
  table,
  exported: expected[table],
  imported: Number(actual[table]),
  same: expected[table] === Number(actual[table]) ? 'yes' : 'NO',
}));
console.table(report);
const mismatches = report.filter((row) => row.same !== 'yes');
console.log(
  mismatches.length === 0
    ? `Import ${mode === 'offline' ? 'check' : ''} ok: every table has the same row count.`
    : `Import mismatch in: ${mismatches.map((row) => row.table).join(', ')}`,
);
process.exit(mismatches.length === 0 ? 0 : 1);
