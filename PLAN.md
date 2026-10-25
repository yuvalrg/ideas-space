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
- Step 1: The build laptop's network blocks Postgres ports (5432/6543), and Docker is not installed. `npm run test:db` therefore runs migrations + seed + `supabase/tests` offline on PGlite with a small Supabase stand-in (`scripts/db-offline/supabase-shim.sql`). `npm run db:push` and `npm run test:db:remote` run from an open network (office network blocks them; WiFi without the office cable works). `supabase test db --linked` needs Docker, so `test:db:remote` sends each test file through `supabase db query --linked` (CLI login, no DB password) and ends it with a raised exception that carries the pgTAP counts and forces the rollback.
- Step 1: With only the anon key, every table and view returns a permission error (401/403 from the REST API), not `[]`. This is by design: anon has no table privileges at all, and RLS is the second layer. The acceptance check "0 rows" passes when no data comes back.
- Step 1: Added `app_settings (key, value)` for the workspace name (not in spec section 7; seed.sql needs it). Added `profiles.email` (spec section 5 lists email as profile data) to link profiles to `allowed_emails`.
- Step 1: `activity_log.summary` stores user content (idea title, item snippet, email), not a Hebrew sentence (hard rule 3). The client builds the Hebrew line from `action` via he.json.
- Step 1: `duplicate_idea(idea_id, title)` takes the new title from the client, so the Hebrew "copy of" prefix stays in he.json.
- Step 1: `create_idea` also requires the summary (`summary_required`), per spec section 6 (two required fields).
- Step 1: `save_idea` sections: a key missing from `p_sections` keeps its content; a blank or null value clears that section. Unknown keys raise `invalid_section_key`.
- Step 1: `invite_partner` on an email whose profile already exists (a removed partner returning) sets it `joined` and reactivates the profile, since the auth trigger runs only on first sign-in.
- Step 1: `touch_last_seen` does not write `activity_log` (it runs on every home screen load).
- Step 1: Every foreign key is `ON DELETE RESTRICT` (not only those to profiles), except `activity_log.idea_id` (`SET NULL`, so the log outlives a phase 2 permanent delete).
- Step 1: Grants are a second layer under RLS: anon has no table privileges, function EXECUTE is revoked from PUBLIC and granted per API function. New tables and functions in later migrations must grant explicitly.
- Step 1: Resource links must start with http(s); items/resources/decisions stamp `created_by` / `deleted_by` / `answered_by` in triggers, so the client cannot spoof them.
- Step 1: Workspace name seeded as "מרחב רעיונות משותף" (no name given yet; editable in settings in step 6).
- Step 2: Auth settings live in `supabase/config.toml` and reach the dev project with `npx supabase config push` (no dashboard edits): site URL and redirect URLs (localhost:5173 dev, localhost:4173 preview), magic link expiry 15 minutes (`otp_expiry = 900`), 60s between links per address. Other values in config.toml were aligned to the project's current values so the push changes only these. Add the production URL in step 8.
- Step 2: Magic links use the implicit flow (`flowType: 'implicit'`), so a link opened on another device (the phone's mail app) still signs in; PKCE would need the code verifier from the requesting browser.
- Step 2: First entry = `profiles.last_seen_at IS NULL`. `/welcome` confirms the display name, then calls `touch_last_seen`. No schema change. The optional picture moves to "my profile" in settings (step 6), since it needs an upload path outside `ideas/`.
- Step 2: The 30-day session in spec section 5 is the Supabase default behaviour (refresh tokens do not expire; the session renews on each visit). Hard session time-boxing is a paid Auth setting; not configured.
- Step 2: The PWA manifest is generated from he.json by a small Vite plugin and served as `/manifest.webmanifest` (not a static `public/manifest.json`), so its Hebrew name stays in he.json. Icons: `public/icons/` (SVG source + 192/512 PNG).
- Step 2: The service worker (`public/sw.js`) registers in production builds only. The in-app browser pane refuses service workers, so registration is checked in a regular browser.
- Step 2: No component library yet; step 2 needs only buttons, inputs and a drawer (plain Tailwind). Choose an RTL-verified library when date pickers and menus arrive (step 5).
- Step 2: The magic-link email uses Supabase's default (English) template and sender until Resend and a Hebrew template are set up in step 8. The default sender allows about 2 emails per hour and delivers only to members of the Supabase organization's team; other addresses get `email_address_not_authorized` (shown as `errors.emailNotAuthorized`). Until Resend: invite each partner's email to the Supabase organization team.
- Step 2: Testing on a phone against the dev server needs the laptop's LAN origin (e.g. `http://192.168.x.y:5173`) in `additional_redirect_urls` and `npm run dev -- --host`, or a deployed preview URL; `localhost` in the link points at the phone itself.
- Step 2: DB types: `src/lib/database.types.ts`, regenerated with `npm run gen:types` after each migration.
- Step 3: No new migration. The home screen loads every live idea once and filters, sorts and marks "new" in the browser (2-6 partners, small data). Search runs on the server: ILIKE on title/summary (`ideas_live`) plus section content (`idea_sections`), merged by idea id. User text is escaped (`% _ \`) and double-quoted inside `.or()`.
- Step 3: Filters, sort and search live in the URL (`?q=&status=&category=&sort=`); the cards/list choice is a per-browser preference in localStorage. The status filter defaults to "active" (hides paused and dropped).
- Step 3: "New since last visit" = updated after the `last_seen_at` read at sign-in, by someone else. The baseline is captured once per page load, then the home screen calls `touch_last_seen`.
- Step 3: One edit mode for the whole idea (title, summary, category, 10 sections) and one save = one version. `saveIdea` always sends all 10 sections (blank clears).
- Step 3: Local draft every 5 seconds while the form differs from the saved idea, keyed per idea, with the version it started from. A restored draft saves against that version, so a change made meanwhile raises the conflict dialog instead of being overwritten silently. Drafts clear on a successful save or an explicit discard.
- Step 3: Dialogs use the native `<dialog>` element (focus trap, Escape, RTL for free); no component library yet.
- Step 4: On the idea page a question stays under "open questions" until answered, then joins the "shared thinking" feed (newest first). The Open Questions screen's "all" = every question not yet answered; "mine" and "unassigned" also exclude answered ones.
- Step 4: Answered questions can be reopened (status back to open, the answer is kept). Items can be soft deleted from the page (spec section 8); restoring them is phase 2.
- Step 4: Assignees are chosen from active partners; a removed partner who is already assigned stays shown by name.
- Step 4: Adding an item does not change the idea's `updated_at`, so it does not trigger the "new" mark on the home screen (the mark follows edits to the idea itself).
- Step 5: Storage object keys accept only a safe ASCII subset, so the path is `ideas/{idea_id}/{file_id}_{ascii name}` (Hebrew letters become `_`, the extension is kept); the original name stays in `files.original_name` and is what the UI shows.
- Step 5: Upload order: storage object, then `files`, then `resources`; if a row insert fails the object is removed again. Not a single transaction (storage is outside Postgres), but nothing is left half-visible.
- Step 5: Due dates use the native `<input type="date">` (RTL in Chrome, Android and iOS); no date-picker library.
- Step 5: Deleting a decision hides it only; the idea keeps the next step, owner and status it set.
- Step 5: The signed-URL expiry was tested with a 2-second URL (fails after expiry, "exp" claim); production URLs last 60 minutes.
- Step 6: Profile pictures live in the same private bucket under `avatars/{profile_id}/`; each partner may upload only into their own folder (storage policy, tested). `profiles.avatar_url` holds the storage path; screens use 60-minute signed URLs. Pictures are resized to 256px.
- Step 6: Removing a partner requires typing their display name (or email if they never joined) - spec decision 6. Removing yourself ends your access at once (the no-access screen).
- Step 6: Inviting does not send an email (Supabase has no invite-only flow that fits magic links here); the address is added to the allowed list and the partner signs in from the login page.
- Step 6: The activity line is "actor · action · idea", with user content (snippet, email, new workspace name) underneath; idea.* actions show only the idea link. Trashed ideas show their title without a link.
- Step 7: One export format for the Settings buttons and the scripts (`src/features/export/format.ts`, no imports so Node runs it directly). The app reads with the member's session (RLS lets members read every table); the CLI reads as the project owner. Same rows either way.
- Step 7: The import pauses triggers (`session_replication_role = replica`) so rows land exactly as exported (no re-stamping, no extra activity), creates an auth user per profile (same id and email), and replaces the seed rows of a fresh project. It refuses a project that already has ideas or profiles.
- Step 7: `--offline` import = the restore check without a second project (PGlite with migrations + seed). The full restore test into a separate Supabase project stays in step 8.
- Step 7: Scripts are TypeScript run by Node's type stripping, hence `engines.node >= 22.18`. Shared helpers: `scripts/db-offline/pglite.mjs` (fresh offline DB) and `scripts/supabase-cli.mjs` (SQL through `supabase db query --linked`).
- Step 7: The CSV lists ideas not in the trash; dates in Israel time.
- Step 8: Two projects without switching the CLI link: everything that targets prod or a restore-test project passes `--linked --project-ref <ref>` (the CLI's way to override the stored link). The dev link stays the default, so no command reaches prod by accident.
- Step 8: Sign-in email templates are server-side text, so their Hebrew lives in `supabase/templates/*.html` and the subjects in `config.toml` (an exception to hard rule 3, which cannot apply to emails Supabase sends). Supabase accepts custom templates only with custom SMTP (tested: 400 "not available for free tier projects using the default email provider").
- Step 8: The Resend API key is passed as `SUPABASE_AUTH_SMTP_PASS` in the partner's terminal for `config push`; it is never written to a file or sent in chat.
- Step 8: Criterion 18 was checked by making `fetch` fail in the page during a save (same effect for the app as a dropped connection). A real airplane-mode check on a phone is in the launch list.

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
- [x] Done 25.10.2026: migrations + seed pushed to the dev project (`npm run db:push`); `npm run test:db`
  (offline) and `npm run test:db:remote` (dev project) both pass, 177 assertions; anon-key REST sweep returns
  401 on all 12 tables and 4 views, `create_idea` refused, `check_email_allowed` true/false as expected.
Read spec sections 3, 7, 8, 11. Prompt: "Write migrations under `supabase/migrations/`: the enums, the 11
tables from spec section 7, the `_live` views (filtering `deleted_at IS NULL`), the pg_trgm indexes,
`is_member()` and `check_email_allowed()`, RLS policies on every table and the storage bucket, the
functions and triggers from PLAN.md's Database contracts, and `supabase/tests/*.sql` proving a non-member
reads and writes nothing while a member succeeds. Create the private `idea-files` bucket with its policies."
Done when: `supabase db reset` applies cleanly; `npm run test:db` passes; a non-member gets 0 rows on every
table; the four write functions exist and raise the listed errors.

### Step 2 - Shell and auth
- [ ] Built 25.10.2026: login (allowed-list check, Hebrew refusal, expired-link message), first-entry name,
  guarded routes, right-side nav with mobile drawer, PWA manifest + icons + service worker. Checked in the
  browser pane (desktop and mobile layouts, refusal message, redirect to login). Still open: the human check,
  two partners signing in on desktop and mobile, and refresh keeping the session.
Read spec sections 5, 6, 12. Prompt: "Build the magic-link login (call `check_email_allowed` first, show the
Hebrew not-allowed message otherwise), profile creation on first entry, the right-side nav (hamburger under
768px), the RTL base, routing, and the PWA manifest. Protect all routes behind a session."
Done when: two partners sign in on desktop and mobile; an email not on the list is refused with the Hebrew
message; refresh keeps the session.

### Step 3 - Ideas and versions
- [x] Done 25.10.2026: home (cards/list, search, status/category filters, sort, new mark), create idea,
  idea page (status, description, 10 sections), edit with local drafts and the conflict dialog, version
  history and restore, duplicate. Checked in Chrome with a signed-in partner: criterion 2 (created in 13s,
  lands on the idea page), 3 (edit -> version 2 in history; draft written after 5s, cleared on save),
  4 (two tabs: conflict dialog, text kept, "load new version" offers the draft, "save anyway" -> new version,
  all versions kept), 13 (restore v2 after v5 -> v6 "restored from 2", v3-v5 kept). Search (summary,
  section, special characters), status filter default and list view checked too. Not yet checked: the
  "new" mark (needs a second partner's edit) and phone width for these screens.
Read spec sections 3, 6, 8. Prompt: "Build the home screen (cards and list, search, status and category
filters, sort, default-hiding paused and dropped, the `new-since-last-visit` mark via `last_seen_at`),
create-idea (two required fields), and the idea page top area plus the current-description and 10 sections,
all saved through `save_idea`. Handle `version_conflict` with the reload-or-overwrite dialog. Build version
history and restore. Save a local draft every 5 seconds."
Done when: spec acceptance criteria 2, 3, 4, 13 pass (create under a minute; edit creates a version; two
concurrent editors get the warning with no lost text; restoring version 2 after 5 makes version 6).

### Step 4 - Shared thinking and questions
- [x] Done 25.10.2026: idea page "open questions" and "shared thinking" areas (add thought / question /
  info; question status, assignee, answer, reopen; soft delete with confirmation) and the cross-idea Open
  Questions screen (all / mine / unassigned / answered; a row opens the question highlighted on its idea).
  Checked in Chrome: criterion 5 (each item shows type, author and time; empty text refused) and 6
  (answering moves the question to "answered", out of "all" and into "answered" on the questions screen).
Read spec section 6. Prompt: "On the idea page, build adding a thought / question / info, answering a
question (moves it to answered), and the cross-idea Open Questions screen with its filters."
Done when: acceptance criteria 5 and 6 pass.

### Step 5 - Resources, files, decisions
- [x] Done 25.10.2026: "resources and files" (link or file; name derived when empty; description and
  "what we learn"; choose file or take photo with `capture="environment"`; 25MB and type checks; images
  over 2500px downscaled; open through a 60-minute signed URL; soft delete) and "decisions and next step"
  (one required field; next step, assignee, due date and new status written to the idea by
  `record_decision`; soft delete). Checked in Chrome: criterion 7 (link and file added; a 3000x2000 photo
  stored at 2500x1667; signed URL opens the file, the same URL fails after it expires, the public URL
  fails), 8 (status changes in activity_log with actor, time, old and new; the activity screen is step 6),
  9 (decision updates the idea header and the home card, overdue date in red). Not checked: the camera on a
  real phone.
Read spec sections 6, 9. Prompt: "Build resources (link or file, one required field), upload to the
`idea-files` bucket with camera capture on mobile and client-side downscaling, signed 60-minute view URLs,
and the decision form calling `record_decision` so next_step/owner/status land on the idea."
Done when: acceptance criteria 7, 8, 9 pass; a signed URL fails after it expires.

### Step 6 - Trash, activity, settings
- [x] Done 25.10.2026: trash (name, who, when, status before; restore only) and "move to trash" on the
  idea page; activity feed (last 50, Hebrew lines from action codes, link to the idea); settings
  (workspace name, live in the menu; my profile: name and a 256px picture; partners with status, invite,
  re-invite, remove with typed-name confirmation and the last-partner guard). Migration
  `20261025120000_avatar_storage.sql` pushed; `test:db` and `test:db:remote` pass (180). Checked in Chrome:
  criterion 10 (trash and restore: 2 items, 2 resources, 1 decision, status kept), 11 (invite adds the
  address, logged; signing in from a new address still needs a real mailbox), 12 (removing yuvalr2d2:
  its next request as that user gets is_member=false, 0 ideas, create_idea refused; re-invite restores).
  The "new" mark (step 3) still needs a second partner's real edit to see.
Read spec sections 5, 6, 8. Prompt: "Build trash (restore only in Phase 1), the group activity feed (last
50), settings (workspace name, partner list with status, invite, remove with typed-name confirm and
last-partner guard), and the `new` mark via `touch_last_seen`."
Done when: acceptance criteria 10, 12 pass; removing a partner blocks their next API call.

### Step 7 - Export, import, print
- [x] Done 25.10.2026: export as JSON (all 12 tables, every row and column) and ideas CSV (UTF-8 with
  BOM), both from Settings and from `npm run export`; `npm run import -- <file> --offline | --linked`;
  print view at `/ideas/:id/print` (description, 10 sections, questions with answers, thoughts and info,
  decisions, resources). Criterion 14: the dev project's export loaded with `--offline` gives identical
  counts in every table; `--linked` into the (non-empty) dev project is refused with target_not_empty and
  changes nothing; the in-app export gives the same counts as the CLI export. Not yet done: a `--linked`
  import into a second, empty Supabase project (that is the step 8 restore test).
Read spec section 10. Prompt: "Write `scripts/export.ts` (full JSON, ideas CSV as UTF-8 with BOM) and
`scripts/import.ts` (load a JSON export into an empty project), and a clean print view for a single idea."
Done when: acceptance criterion 14 passes (export JSON imports into a test project with identical counts).

### Step 8 - Hardening and launch
- [ ] Prepared 25.10.2026 (the rest needs the partners' accounts; step-by-step in `docs/launch.he.md`):
  `vercel.json` (SPA routes, security and cache headers); Hebrew sign-in email templates
  (`supabase/templates/`, active once custom SMTP is set); commented Resend SMTP and
  `[remotes.production]` sections in `config.toml`; `npm run check:anon` (criterion 19, passes on dev);
  export/import accept `--project-ref=<ref>` (prod and restore-test projects without relinking).
  Criterion 18 checked on dev in Chrome (simulated network drop on idea edit, new item and new idea:
  red error, text kept, edit draft kept; retry saves). Open: GitHub, domain, Resend, `ideas-prod`,
  Vercel, then criteria 1-17 in prod by a partner who did not write the code, restore test (15),
  RTL/mobile list (16), speed with 50 ideas (17), security review.
Read spec sections 9, 10. Prompt: "Configure Resend SMTP and the custom domain, create and migrate
`ideas-prod`, run the restore test and log it, go through the RTL and mobile checklist, and fix anything the
acceptance criteria surface."
Done when: acceptance criteria 15-19 pass; a `curl` with only the anon key returns 0 rows from every table;
a mid-save network drop shows an error and keeps the text.

---

## Acceptance criteria

The 19 acceptance criteria are in `docs/spec.he.md` section 14. Phase 1 is done when all pass in prod,
checked by a partner who did not write the code.
