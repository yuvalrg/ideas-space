// The export file format (spec section 10), shared by the settings buttons and scripts/export.ts /
// scripts/import.ts. Self-contained on purpose (no imports) so Node can load it directly.
//
// {
//   "format": "ideas-space-export",
//   "version": 1,
//   "exported_at": "<ISO time>",
//   "tables": { "<table>": [ <every row, every column, as stored> ], ... }
// }
//
// Files themselves are not included (phase 2 ZIP); their records (files table) are.

export const EXPORT_FORMAT = 'ideas-space-export';
export const EXPORT_VERSION = 1;

/** Every table, in an order where each row's references come earlier (used by the import). */
export const EXPORT_TABLES = [
  'profiles',
  'allowed_emails',
  'app_settings',
  'categories',
  'ideas',
  'idea_sections',
  'idea_versions',
  'files',
  'items',
  'decisions',
  'resources',
  'activity_log',
] as const;

export type ExportTable = (typeof EXPORT_TABLES)[number];
export type Row = Record<string, unknown>;

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  version: number;
  exported_at: string;
  tables: Record<ExportTable, Row[]>;
}

export function isExportFile(value: unknown): value is ExportFile {
  if (!value || typeof value !== 'object') return false;
  const file = value as Partial<ExportFile>;
  return (
    file.format === EXPORT_FORMAT &&
    typeof file.version === 'number' &&
    !!file.tables &&
    EXPORT_TABLES.every((table) => Array.isArray(file.tables?.[table]))
  );
}

export function rowCounts(file: ExportFile): Record<ExportTable, number> {
  return Object.fromEntries(
    EXPORT_TABLES.map((table) => [table, file.tables[table].length]),
  ) as Record<ExportTable, number>;
}

/** YYYY-MM-DD in Israel time, for file names. */
export function exportDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(date);
}

const dateTime = new Intl.DateTimeFormat('he-IL', {
  timeZone: 'Asia/Jerusalem',
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function cell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Hebrew labels the caller takes from he.json (keys csv.* and status.*). */
export interface CsvLabels {
  headers: [string, string, string, string, string, string, string, string, string, string];
  status: Record<string, string>;
}

const BOM = String.fromCharCode(0xfeff); // Excel reads UTF-8 only with it

/**
 * Ideas CSV (spec section 10): one row per idea not in the trash; name, description, category,
 * status, creator, owner, next step, created, updated, open questions. UTF-8 with a BOM so Excel
 * shows the Hebrew correctly.
 */
export function buildIdeasCsv(file: ExportFile, labels: CsvLabels): string {
  const names = new Map(file.tables.profiles.map((p) => [p.id, String(p.display_name ?? '')]));
  const categories = new Map(file.tables.categories.map((c) => [c.id, String(c.name ?? '')]));
  const openQuestions = new Map<unknown, number>();
  for (const item of file.tables.items) {
    if (item.type === 'question' && item.question_status !== 'answered' && !item.deleted_at) {
      openQuestions.set(item.idea_id, (openQuestions.get(item.idea_id) ?? 0) + 1);
    }
  }
  const rows = file.tables.ideas
    .filter((idea) => !idea.deleted_at)
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
    .map((idea) => [
      idea.title,
      idea.summary,
      categories.get(idea.category_id) ?? '',
      labels.status[String(idea.status)] ?? idea.status,
      names.get(idea.created_by) ?? '',
      names.get(idea.owner_id) ?? '',
      idea.next_step,
      dateTime.format(new Date(String(idea.created_at))),
      dateTime.format(new Date(String(idea.updated_at))),
      openQuestions.get(idea.id) ?? 0,
    ]);
  const lines = [labels.headers, ...rows].map((row) => row.map(cell).join(','));
  return `${BOM}${lines.join('\r\n')}\r\n`;
}
