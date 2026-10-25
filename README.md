# Shared Ideas Space

A private Hebrew (RTL) web app for 2-4 partners to capture, discuss, refine and decide on tourism ideas.
No idea is lost: every save is versioned, every delete is soft, backups are tested.

- Product spec (Hebrew, source of truth): `docs/spec.he.md`
- Build conventions for Claude Code: `CLAUDE.md`
- Step-by-step build plan: `PLAN.md`
- Launch guide (Hebrew: accounts, prod, checks): `docs/launch.he.md`

## Stack
React + TypeScript + Vite, Tailwind (RTL), Supabase (Postgres + RLS, Auth magic link, Storage). No custom server.

## Getting started (for the builder)
1. Finish the human prerequisites in `PLAN.md`.
2. Copy `supabase/seed.template.sql` to `supabase/seed.sql` and fill the INSERT placeholders (workspace name, partner emails).
3. Open Claude Code in this folder and follow `PLAN.md` from step 0.

## Database
- Schema, RLS, functions and the `idea-files` bucket: `supabase/migrations/*.sql` (applied in file order).
- Seed (workspace name, categories, allowed emails): `supabase/seed.sql`. Safe to re-run.
- Link the CLI once: `npx supabase login`, then `npx supabase link --project-ref <ref>`.
- Apply to the linked dev project: `npm run db:push` (migrations + seed). Needs Postgres ports 5432/6543
  open (not on a blocking corporate network); the CLI login is enough, no database password.
- Tests: `npm run test:db` runs `supabase/tests/*.sql` (pgTAP) offline on PGlite, no Docker or network.
  `npm run test:db:remote` runs the same tests against the linked dev project through the Supabase CLI
  login (no database password needed). Every test file rolls back, so no test data is left behind.

## Export, import and restore check
Node 22.18 or newer (the scripts are TypeScript run directly by Node).

- **In the app:** Settings -> "גיבוי וייצוא": the whole database as JSON, or the ideas as CSV.
- **From the command line:** `npm run export` saves both into `exports/<YYYY-MM-DD>/` (gitignored).
  It reads the linked project through the Supabase CLI.
- **Import:** `npm run import -- <file.json> --offline` loads the file into a fresh local database
  (migrations + seed, no network) and compares the row count of every table. This is the quick
  restore check. `npm run import -- <file.json> --linked` loads it into the project the CLI is linked
  to, which must be new (no ideas and no profiles yet; seed rows are replaced). Partners get auth users
  with the same id and email, so they sign in as before.

The JSON file (format version 1):

```json
{
  "format": "ideas-space-export",
  "version": 1,
  "exported_at": "2026-10-25T19:30:00.000Z",
  "tables": {
    "profiles": [], "allowed_emails": [], "app_settings": [], "categories": [],
    "ideas": [], "idea_sections": [], "idea_versions": [], "files": [],
    "items": [], "decisions": [], "resources": [], "activity_log": []
  }
}
```

Every table holds every row with every column as stored, including trashed ideas, soft-deleted
items, all versions and the activity log. The files themselves are not included (phase 2 ZIP); their
records in `files` are. The ideas CSV is UTF-8 with a BOM (opens in Excel with Hebrew intact): one row
per idea not in the trash with name, description, category, status, creator, owner, next step, created,
updated and open questions.

## Operations
- Backup owner: INSERT name. Deputy (acts if not done by the 10th of the month): INSERT name.
- Monthly: Settings -> "ייצוא כל המאגר (JSON)" (or `npm run export`), save the JSON to the shared drive.
- Twice a year: the restore test in `docs/spec.he.md` section 10. Quick form: `npm run import --
  <latest.json> --offline` (counts must match); full form: a new Supabase project, `npm run db:push`
  there, then `npm run import -- <latest.json> --linked`. Log date, who and result.

## Notes
- Code, comments and migrations are in English. Hebrew lives only in `src/lib/i18n/he.json`, `docs/`, and seed values.
- Never commit `.env*`. The browser only ever holds the Supabase anon key.
