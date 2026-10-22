# PLAN.md - Build plan for Claude Code

Phase 1 (MVP) of the Shared Ideas Space, built step by step with Claude Code.
Spec: `docs/spec.he.md` (Hebrew, source of truth). Conventions: `CLAUDE.md`.

## How to use this plan

1. Finish the human prerequisites below before step 0.
2. Open Claude Code in the repo root. Start each session with:
   `Read CLAUDE.md and PLAN.md. We are on step N. Read docs/spec.he.md sections <listed in the step>, then do the step.`
3. Paste the step's prompt, let it work, review the diff.
4. Run the "Done when" checks yourself. On failure, paste the failure back into the same session.
5. When the checks pass: commit (`step N: <what>`), tick the box here, move on.
6. One step per session where possible. Steps 1 and 3 are the hardest; the rest are mostly UI.

## Human prerequisites (before step 0)

- [ ] Private GitHub repo `ideas-space`, two owners.
- [ ] Supabase org, two owners, project `ideas-dev` (region: Frankfurt). `ideas-prod` is created in step 8.
- [ ] Vercel or Netlify team linked to the repo.
- [ ] Resend account and a group-owned sending domain with SPF and DKIM DNS (needed step 8; DNS can take a day).
- [ ] Node 20+, Supabase CLI, git on the build machine.
- [ ] Seed inputs: workspace name, partner emails (the 7 categories are already in the template).
- [ ] Names of the backup owner and backup deputy (for the README).

## Parking lot (not in Phase 1)

Permanent delete, version diff, threaded comments, idea-to-idea links, weekly digest email, editable
categories and statuses in the UI, trash auto-cleanup, admin role. See spec section 4 and 15.
Add new out-of-scope ideas here instead of building them.

## Decisions made during build

(Claude Code appends one line per decision taken when the spec was silent.)

- Step 0: Tailwind v4 via `@tailwindcss/vite` (CSS-first config in `src/index.css`, logical utilities `ms-/me-/ps-/pe-/border-s`).
- Step 0: Heebo self-hosted via `@fontsource/heebo` (same Google Font, no runtime CDN call).
- Step 0: React pinned to 18.x per CLAUDE.md; Vite 8, TypeScript 6, ESLint 10 flat config with `typescript-eslint` strict + Prettier.
- Step 0: `src/lib/supabase.ts` creates the client lazily (`getSupabase()`), so the shell renders without `.env.local`.
- Step 0: `index.html` title is English; the Hebrew title is set from `he.json` in `src/main.tsx` (hard rule 2).
- Step 0: `public/manifest.json` deferred to step 2 (PWA is in that step's prompt).

---

## Database contracts (shared by steps 1, 3, 5, 6)

Every function: `SECURITY DEFINER`, `SET search_path = public`, first line
`IF NOT is_member() THEN RAISE EXCEPTION 'not_a_member'; END IF;`, and writes `activity_log` in the same
transaction. Errors use short machine codes; the client maps them to Hebrew via `he.json`.

- `is_member()` -> boolean. True when the caller's lowercased email is in `allowed_emails` with
  `status='joined'` and the profile is active. Used by every RLS policy.
- `check_email_allowed(p_email)` -> boolean, callable by `anon`. True if the email is `invited` or `joined`.
  The login page calls it before sending the magic link.
- `create_idea(title, summary, category_id, interesting)` -> uuid. Idea at `version_no=1`, stores
  `interesting` as the value section, writes version 1 (`create`), logs `idea.created`. Error: `title_required`.
- `save_idea(idea_id, expected_version, title, summary, category_id, sections jsonb)` -> int. Rejects if
  `version_no != expected_version` (error `version_conflict`, detail = who and when). If nothing changed,
  returns the current version with no new one. Otherwise bumps `version_no`, writes a full snapshot
  (`edit`), logs `idea.edited` with the changed fields.
- `restore_version(idea_id, version_no)` -> int. Applies that snapshot, creates a new version
  (`restore`, `restored_from_version`), logs `idea.restored`. Items, decisions, resources, status untouched.
  Error: `version_not_found`.
- `duplicate_idea(idea_id)` -> uuid. New idea, title prefixed, copies summary/category/sections, status
  `new`, version 1, no items or history.
- `set_idea_status(idea_id, status)` -> void. Logs `idea.status_changed` with old and new.
- `record_decision(idea_id, content, reason, basis, next_step, assignee_id, due_date, new_status)` -> uuid.
  Inserts the decision; copies next_step/assignee/due to the idea when given; updates status when given.
  Logs `decision.recorded`. Error: `content_required`.
- `trash_idea(idea_id)` / `restore_idea(idea_id)` -> void. Set or clear `deleted_at` + `deleted_by`.
- `invite_partner(email)` / `remove_partner(email)` -> void. Upsert status `invited` / `removed`.
  Remove refuses the last joined partner (error `last_partner`) and marks the profile inactive.
- `touch_last_seen()` -> void. Sets the caller's `profiles.last_seen_at`; called when the home screen loads.

Triggers: on `auth.users` insert, create the profile and set the email to `joined` (and reject an
email not in `allowed_emails`); on `items` and `resources` insert/update, write the matching
`activity_log` rows.

---

## Steps

### Step 0 - Scaffold
- [x] Done 21.10.2026 (dev, lint, typecheck, build pass; `.env.local` ignored). Committed 22.10.2026 as `step 0: scaffold`.
Prompt: "Scaffold the Vite + React + TypeScript app with Tailwind (logical properties, RTL),
`html lang=he dir=rtl`, the folder layout from CLAUDE.md, `he.json` with a few starter keys, the Supabase
client in `src/lib/supabase.ts` reading env vars, ESLint + Prettier + tsconfig strict, and a Heebo font.
Add `supabase/seed.template.sql` with the 7 categories and INSERT placeholders for workspace name and
partner emails. No features yet."
Done when: `npm run dev` shows an RTL Hebrew placeholder page; `npm run lint` and `npm run typecheck` pass;
`.env.local` is gitignored.

### Step 1 - Database foundation
Read spec sections 3, 7, 8, 11. Prompt: "Write migrations under `supabase/migrations/`: the enums, the 11
tables from spec section 7, the `_live` views (filtering `deleted_at IS NULL`), the pg_trgm indexes,
`is_member()` and `check_email_allowed()`, RLS policies on every table and the storage bucket, the
functions and triggers from PLAN.md's Database contracts, and `supabase/tests/*.sql` proving a non-member
reads and writes nothing while a member succeeds. Create the private `idea-files` bucket with its policies."
Done when: `supabase db reset` applies cleanly; `npm run test:db` passes; a non-member gets 0 rows on every
table; the four write functions exist and raise the listed errors.

### Step 2 - Shell and auth
Read spec sections 5, 6, 12. Prompt: "Build the magic-link login (call `check_email_allowed` first, show the
Hebrew not-allowed message otherwise), profile creation on first entry, the right-side nav (hamburger under
768px), the RTL base, routing, and the PWA manifest. Protect all routes behind a session."
Done when: two partners sign in on desktop and mobile; an email not on the list is refused with the Hebrew
message; refresh keeps the session.

### Step 3 - Ideas and versions
Read spec sections 3, 6, 8. Prompt: "Build the home screen (cards and list, search, status and category
filters, sort, default-hiding paused and dropped, the `new-since-last-visit` mark via `last_seen_at`),
create-idea (two required fields), and the idea page top area plus the current-description and 10 sections,
all saved through `save_idea`. Handle `version_conflict` with the reload-or-overwrite dialog. Build version
history and restore. Save a local draft every 5 seconds."
Done when: spec acceptance criteria 2, 3, 4, 13 pass (create under a minute; edit creates a version; two
concurrent editors get the warning with no lost text; restoring version 2 after 5 makes version 6).

### Step 4 - Shared thinking and questions
Read spec section 6. Prompt: "On the idea page, build adding a thought / question / info, answering a
question (moves it to answered), and the cross-idea Open Questions screen with its filters."
Done when: acceptance criteria 5 and 6 pass.

### Step 5 - Resources, files, decisions
Read spec sections 6, 9. Prompt: "Build resources (link or file, one required field), upload to the
`idea-files` bucket with camera capture on mobile and client-side downscaling, signed 60-minute view URLs,
and the decision form calling `record_decision` so next_step/owner/status land on the idea."
Done when: acceptance criteria 7, 8, 9 pass; a signed URL fails after it expires.

### Step 6 - Trash, activity, settings
Read spec sections 5, 6, 8. Prompt: "Build trash (restore only in Phase 1), the group activity feed (last
50), settings (workspace name, partner list with status, invite, remove with typed-name confirm and
last-partner guard), and the `new` mark via `touch_last_seen`."
Done when: acceptance criteria 10, 12 pass; removing a partner blocks their next API call.

### Step 7 - Export, import, print
Read spec section 10. Prompt: "Write `scripts/export.ts` (full JSON, ideas CSV as UTF-8 with BOM) and
`scripts/import.ts` (load a JSON export into an empty project), and a clean print view for a single idea."
Done when: acceptance criterion 14 passes (export JSON imports into a test project with identical counts).

### Step 8 - Hardening and launch
Read spec sections 9, 10. Prompt: "Configure Resend SMTP and the custom domain, create and migrate
`ideas-prod`, run the restore test and log it, go through the RTL and mobile checklist, and fix anything the
acceptance criteria surface."
Done when: acceptance criteria 15-19 pass; a `curl` with only the anon key returns 0 rows from every table;
a mid-save network drop shows an error and keeps the text.

---

## Acceptance criteria

The 19 acceptance criteria are in `docs/spec.he.md` section 14. Phase 1 is done when all pass in prod,
checked by a partner who did not write the code.
