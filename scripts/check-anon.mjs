// npm run check:anon: acceptance criterion 19. With only the anon key (what anyone can read from the
// website), every table and view must return no rows, the API functions must refuse, and the file
// bucket must list nothing. Reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from the environment or
// .env.local; for prod: SUPABASE_URL=... SUPABASE_ANON_KEY=... npm run check:anon

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { root } from './db-offline/pglite.mjs';

async function envValue(name) {
  if (process.env[name]) return process.env[name];
  try {
    const text = await readFile(join(root, '.env.local'), 'utf8');
    return text.match(new RegExp(`^VITE_${name}=(.*)$`, 'm'))?.[1]?.trim();
  } catch {
    return undefined;
  }
}

const url = (await envValue('SUPABASE_URL')) ?? process.env.VITE_SUPABASE_URL;
const key = (await envValue('SUPABASE_ANON_KEY')) ?? process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY (or keep them in .env.local).');
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const relations = [
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
  'ideas_live',
  'items_live',
  'decisions_live',
  'resources_live',
];

const results = [];
for (const name of relations) {
  const response = await fetch(`${url}/rest/v1/${name}?select=*&limit=1`, { headers });
  const body = await response.text();
  // A permission error (401/403) or an empty list both mean "no data"; any row is a failure.
  const rows = response.ok ? JSON.parse(body).length : 0;
  results.push({ check: `table ${name}`, status: response.status, rows, pass: rows === 0 });
}

const rpc = async (name, args) => {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(args),
  });
  return { status: response.status, body: await response.text() };
};
const create = await rpc('create_idea', { p_title: 'anon', p_summary: 'anon' });
results.push({
  check: 'rpc create_idea',
  status: create.status,
  rows: 0,
  pass: !create.status.toString().startsWith('2'),
});
const members = await rpc('is_member', {});
results.push({
  check: 'rpc is_member',
  status: members.status,
  rows: 0,
  pass: !members.status.toString().startsWith('2'),
});

const list = await fetch(`${url}/storage/v1/object/list/idea-files`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ prefix: 'ideas/', limit: 10 }),
});
const objects = list.ok ? JSON.parse(await list.text()).length : 0;
results.push({
  check: 'storage list ideas/',
  status: list.status,
  rows: objects,
  pass: objects === 0,
});

console.table(results);
const failed = results.filter((r) => !r.pass);
console.log(
  failed.length === 0
    ? 'Anon check ok: no data with the anon key alone.'
    : `FAILED: ${failed.map((r) => r.check).join(', ')}`,
);
process.exit(failed.length === 0 ? 0 : 1);
