// npm run export [-- --project-ref=<ref>]: saves the whole database (JSON) and the ideas CSV of the
// linked project (or the given one, e.g. prod) into
// exports/<YYYY-MM-DD>/ (spec section 10). Reads as the project owner through the Supabase CLI, so
// it includes everything a member sees, trashed ideas too. The same format as the settings button.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  EXPORT_FORMAT,
  EXPORT_TABLES,
  EXPORT_VERSION,
  buildIdeasCsv,
  exportDate,
  isExportFile,
  rowCounts,
  type CsvLabels,
} from '../src/features/export/format.ts';
import { root } from './db-offline/pglite.mjs';
import { queryLinked } from './supabase-cli.mjs';

const keyOf = (table: string) =>
  table === 'app_settings' ? 'key' : table === 'allowed_emails' ? 'email' : 'id';

const sql = `select json_build_object(
  'format', '${EXPORT_FORMAT}',
  'version', ${EXPORT_VERSION},
  'exported_at', now(),
  'tables', json_build_object(
${EXPORT_TABLES.map(
  (table) =>
    `    '${table}', (select coalesce(json_agg(t order by t.${keyOf(table)}), '[]'::json) from public.${table} t)`,
).join(',\n')}
  )
) as export;`;

const rows = (await queryLinked(sql)) as { export: unknown }[];
const file = rows[0]?.export;
if (!isExportFile(file)) {
  console.error('The export did not come back in the expected format.');
  process.exit(1);
}

const he = JSON.parse(
  await readFile(join(root, 'src', 'lib', 'i18n', 'he.json'), 'utf8'),
) as Record<string, string>;
const labels: CsvLabels = {
  headers: [
    he['csv.title'],
    he['csv.summary'],
    he['csv.category'],
    he['csv.status'],
    he['csv.creator'],
    he['csv.owner'],
    he['csv.nextStep'],
    he['csv.created'],
    he['csv.updated'],
    he['csv.openQuestions'],
  ],
  status: Object.fromEntries(
    ['new', 'discussion', 'review', 'approved', 'paused', 'dropped'].map((s) => [
      s,
      he[`status.${s}`],
    ]),
  ),
};

const day = exportDate();
const dir = join(root, 'exports', day);
await mkdir(dir, { recursive: true });
const jsonPath = join(dir, `ideas-space-${day}.json`);
const csvPath = join(dir, `ideas-${day}.csv`);
await writeFile(jsonPath, JSON.stringify(file, null, 2), 'utf8');
await writeFile(csvPath, buildIdeasCsv(file, labels), 'utf8');

console.log(`Saved ${jsonPath}`);
console.log(`Saved ${csvPath}`);
console.table(rowCounts(file));
