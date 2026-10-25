# CLAUDE.md - Shared Ideas Space (Hebrew, RTL)

This file is read by Claude Code at the start of every session. It is short on purpose.
The full product spec is in `docs/spec.he.md` (Hebrew). The step-by-step build plan is in `PLAN.md`.
When the spec and this file disagree, the spec wins; update this file.

## What we are building

A private web app for 2-4 partners to capture, discuss, refine and decide on tourism business ideas.
Hebrew UI, RTL from the ground up, one user role ("partner"), everyone sees and edits everything.
No idea is ever lost: every save creates a version, every delete is soft, backups are tested.

Phase 1 (MVP) scope is defined in `docs/spec.he.md` section 4. Do not add features outside it.
If something seems missing, add a note to `PLAN.md` under "Parking lot" instead of building it.

## Stack (decided, do not change)

- Client: React 18 + TypeScript + Vite, single-page app, no SSR.
- Styling: Tailwind CSS with logical properties only. Component library must support RTL (verify before adopting).
- Backend: Supabase only. Postgres with Row Level Security, Supabase Auth (magic link), Supabase Storage.
  No custom server. Multi-step writes are Postgres functions (SECURITY DEFINER).
- Email: external SMTP (Resend) configured in Supabase Auth before launch.
- Hosting: Vercel (or Netlify), auto-deploy from `main`.
- Migrations: Supabase CLI, every schema change is a SQL file under `supabase/migrations/`.
- Two Supabase projects: `dev` and `prod`. Never develop against prod.

## Repository layout

```
CLAUDE.md                     this file
PLAN.md                       build plan: steps, prompts, done-when checks
docs/spec.he.md               product spec v2 (Hebrew), source of truth
supabase/migrations/*.sql     schema, RLS, functions, triggers (English, commented)
supabase/seed.sql             categories, allowed emails, workspace name (from seed.template.sql)
supabase/tests/*.sql          RLS and function tests
scripts/export.ts             full JSON + CSV export
scripts/import.ts             restore a JSON export into an empty project
src/lib/supabase.ts           client + typed helpers
src/lib/i18n/he.json          every UI string, Hebrew only
src/features/<area>/          auth, ideas, items, resources, decisions, trash, activity, settings, export
src/components/               shared UI
src/routes/                   one file per screen
public/icons/, public/sw.js   PWA icons and service worker (manifest generated from he.json in vite.config.ts)
src/lib/database.types.ts     generated DB types (npm run gen:types)
```

## Hard rules

1. Writes to `ideas`, `idea_sections`, `idea_versions` go only through the DB functions
   `save_idea`, `restore_version`, `record_decision`, `trash_idea`, `restore_idea`.
   Direct inserts are allowed for `items`, `resources`, `decisions` (via `record_decision`), `files`; triggers log activity.
2. No UI string in code. Everything comes from `src/lib/i18n/he.json`. Keys in English, values in Hebrew.
3. Code, comments, column names, enum values, migrations and commit messages are in English.
   Hebrew appears only in `he.json`, `docs/`, and `seed.sql` values.
4. CSS: never `left` / `right` / `margin-left` / `padding-right` / `text-align: left`.
   Use `inline-start` / `inline-end` / `text-align: start`. Icons that imply direction flip under RTL.
5. No secrets in the client. The anon key is the only key in the browser. `service_role` lives only in Edge Function secrets.
6. Every form handles a failed save: show an error, keep the user's text. No optimistic UI for saves.
7. Soft delete everywhere (`deleted_at`, `deleted_by`). Phase 1 has no hard delete in the UI.
8. Each step in `PLAN.md` ends with its "Done when" checks passing. Do not start the next step before that.
9. One commit per completed step (or sub-task), message `step N: <what>`. Never commit `.env*` files.
10. Hyphens, never em dashes, in any text you write.

## Vocabulary (Hebrew UI, English code)

| Code / enum | Hebrew UI |
| --- | --- |
| idea | רעיון |
| status: new / discussion / review / approved / paused / dropped | חדש / בדיון / בבדיקה / מאושר להמשך / מושהה / לא ממשיכים |
| item type: thought / question / info | מחשבה / שאלה / מידע |
| question_status: open / in_review / answered | פתוחה / בבדיקה / נענתה |
| next_step | הצעד הבא |
| owner / assignee | אחראי |
| updated_at | עודכן לאחרונה |
| partner (profile) | שותף |
| trash | סל המחזור |
| section keys: audience, problem, value, how_it_works, existing_solutions, opportunity, revenue_model, partners_suppliers, costs_resources, risks | למי הרעיון מיועד, מה הצורך או הבעיה, מה הערך למשתמש, כיצד הרעיון יעבוד, אילו פתרונות כבר קיימים, מה ההזדמנות העסקית, כיצד ניתן לייצר הכנסה, מי יכולים להיות שותפים או ספקים, אילו עלויות ומשאבים נדרשים, מהם הסיכונים |

## Commands

```
npm install
npm run dev                      # Vite dev server against the dev Supabase project
npm run build && npm run preview
npm run lint && npm run typecheck
supabase start                   # optional local stack
supabase db push                 # apply migrations to the linked project
supabase db reset                # local: rebuild from migrations + seed
npm run test:db                  # runs supabase/tests/*.sql offline on PGlite (no Docker, no network)
npm run test:db:remote           # same tests against the linked dev project (needs open Postgres ports)
npm run db:push                  # migrations + seed to the linked dev project
npm run gen:types                # regenerate src/lib/database.types.ts after a migration
npx supabase config push         # auth settings from supabase/config.toml (run config diff first)
npm run check:anon               # criterion 19: anon key alone gets no data (SUPABASE_URL/ANON_KEY for prod)
# prod / restore-test project without relinking: add --linked --project-ref <ref> to supabase commands,
# or --project-ref=<ref> to npm run export / import. See docs/launch.he.md.
npm run export                   # scripts/export.ts -> exports/<date>/
npm run import -- <file.json> --offline   # restore check into a fresh local database
npm run import -- <file.json> --linked    # into the linked project, refused unless it is empty
```

Environment variables (`.env.local`, never committed): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## When unsure

Read the relevant section of `docs/spec.he.md` first. If the spec is silent, choose the simplest option
that keeps data safe, write a one-line note in `PLAN.md` under "Decisions made during build", and continue.
Ask the human only for things that cannot be decided from the spec (credentials, emails, names).
