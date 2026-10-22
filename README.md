# Shared Ideas Space

A private Hebrew (RTL) web app for 2-4 partners to capture, discuss, refine and decide on tourism ideas.
No idea is lost: every save is versioned, every delete is soft, backups are tested.

- Product spec (Hebrew, source of truth): `docs/spec.he.md`
- Build conventions for Claude Code: `CLAUDE.md`
- Step-by-step build plan: `PLAN.md`

## Stack
React + TypeScript + Vite, Tailwind (RTL), Supabase (Postgres + RLS, Auth magic link, Storage). No custom server.

## Getting started (for the builder)
1. Finish the human prerequisites in `PLAN.md`.
2. Copy `supabase/seed.template.sql` to `supabase/seed.sql` and fill the INSERT placeholders (workspace name, partner emails).
3. Open Claude Code in this folder and follow `PLAN.md` from step 0.

## Operations
- Backup owner: INSERT name. Deputy (acts if not done by the 10th of the month): INSERT name.
- Monthly: run `npm run export`, save the JSON to the shared drive.
- Twice a year: run the restore test in `docs/spec.he.md` section 10 and log the result.

## Notes
- Code, comments and migrations are in English. Hebrew lives only in `src/lib/i18n/he.json`, `docs/`, and seed values.
- Never commit `.env*`. The browser only ever holds the Supabase anon key.
