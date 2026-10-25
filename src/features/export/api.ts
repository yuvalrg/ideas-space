import { t } from '../../lib/i18n';
import { getSupabase } from '../../lib/supabase';
import { IDEA_STATUSES, STATUS_LABEL } from '../ideas/api';
import {
  EXPORT_FORMAT,
  EXPORT_TABLES,
  EXPORT_VERSION,
  buildIdeasCsv,
  exportDate,
  type CsvLabels,
  type ExportFile,
  type Row,
} from './format';

const PAGE = 1000; // PostgREST returns at most 1000 rows per request

async function readAll(table: (typeof EXPORT_TABLES)[number]): Promise<Row[]> {
  // Stable order by primary key, so paging neither skips nor repeats rows.
  const key = table === 'app_settings' ? 'key' : table === 'allowed_emails' ? 'email' : 'id';
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const result = await getSupabase()
      .from(table)
      .select('*')
      .order(key)
      .range(from, from + PAGE - 1);
    if (result.error) throw result.error;
    rows.push(...(result.data as Row[]));
    if (result.data.length < PAGE) return rows;
  }
}

/** Everything a member can read: all tables, including trashed ideas, versions and activity. */
export async function buildExport(): Promise<ExportFile> {
  const tables = {} as ExportFile['tables'];
  for (const table of EXPORT_TABLES) tables[table] = await readAll(table);
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exported_at: new Date().toISOString(),
    tables,
  };
}

export function csvLabels(): CsvLabels {
  return {
    headers: [
      t('csv.title'),
      t('csv.summary'),
      t('csv.category'),
      t('csv.status'),
      t('csv.creator'),
      t('csv.owner'),
      t('csv.nextStep'),
      t('csv.created'),
      t('csv.updated'),
      t('csv.openQuestions'),
    ],
    status: Object.fromEntries(IDEA_STATUSES.map((s) => [s, t(STATUS_LABEL[s])])),
  };
}

function download(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Downloads the whole database as JSON; returns the file name. */
export async function downloadJson(): Promise<string> {
  const file = await buildExport();
  const name = `ideas-space-${exportDate()}.json`;
  download(name, JSON.stringify(file, null, 2), 'application/json');
  return name;
}

/** Downloads the ideas CSV (UTF-8 with BOM); returns the file name. */
export async function downloadCsv(): Promise<string> {
  const file = await buildExport();
  const name = `ideas-${exportDate()}.csv`;
  download(name, buildIdeasCsv(file, csvLabels()), 'text/csv;charset=utf-8');
  return name;
}
