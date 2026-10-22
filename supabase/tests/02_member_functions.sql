-- Database contracts (PLAN.md): versions, conflicts, restore, items, decisions, trash, duplicate,
-- partners. Calls run as the authenticated role, like the browser. Rolls back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

-- Test helpers --------------------------------------------------------------------------------------

create schema tests;

create function tests.add_partner(p_id uuid, p_email text) returns void language plpgsql as $$
begin
  insert into public.allowed_emails (email, status) values (p_email, 'invited') on conflict (email) do nothing;
  insert into auth.users (id, email) values (p_id, p_email);
end $$;

create function tests.act_as(p_id uuid, p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_id, 'email', p_email, 'role', 'authenticated')::text, true);
end $$;

-- The DETAIL of the error a statement raises, as jsonb.
create function tests.error_detail(p_sql text) returns jsonb language plpgsql as $$
declare v text;
begin
  execute p_sql;
  return null;
exception when others then
  get stacked diagnostics v = pg_exception_detail;
  return v::jsonb;
end $$;

grant usage on schema tests to authenticated;
grant execute on all functions in schema tests to authenticated;

-- Fixture -------------------------------------------------------------------------------------------

-- Only the test partners are joined inside this transaction, so the last-partner check is deterministic.
update public.allowed_emails set status = 'removed' where status = 'joined';

select tests.add_partner('aaaaaaaa-0000-4000-8000-00000000000a', 'member-a@test.local');
select tests.add_partner('bbbbbbbb-0000-4000-8000-00000000000b', 'member-b@test.local');
insert into public.categories (name) values ('Test category') on conflict (name) do nothing;
insert into public.app_settings (key, value) values ('test_key', 'before') on conflict (key) do update set value = 'before';

create temp table ctx (
  idea_id uuid,
  dup_id uuid,
  question_id uuid,
  thought_id uuid,
  decision_id uuid,
  cat_id uuid
) on commit drop;
insert into ctx (cat_id) select id from public.categories where name = 'Test category';
grant all on ctx to authenticated;

-- As partner A -----------------------------------------------------------------------------------------

select tests.act_as('aaaaaaaa-0000-4000-8000-00000000000a', 'member-a@test.local');
set local role authenticated;

-- create_idea
select lives_ok(
  $$update ctx set idea_id = public.create_idea('Desert night tour', 'Guided night walks', null, 'Stars and silence')$$,
  'create_idea succeeds');
select is((select version_no from public.ideas where id = (select idea_id from ctx)), 1, 'new idea is at version 1');
select is((select status::text from public.ideas where id = (select idea_id from ctx)), 'new', 'new idea has status new');
select is((select count(*) from public.idea_versions where idea_id = (select idea_id from ctx)), 1::bigint, 'version 1 row written');
select is((select change_type::text from public.idea_versions where idea_id = (select idea_id from ctx) and version_no = 1), 'create', 'version 1 is a create');
select is((select content from public.idea_sections where idea_id = (select idea_id from ctx) and section_key = 'value'),
  'Stars and silence', 'interesting part stored as the value section');
select is((select created_by from public.ideas where id = (select idea_id from ctx)),
  'aaaaaaaa-0000-4000-8000-00000000000a'::uuid, 'created_by is the caller');
select is((select count(*) from public.activity_log where idea_id = (select idea_id from ctx) and action = 'idea.created'),
  1::bigint, 'idea.created logged');
select throws_ok($$select public.create_idea('   ', 'x')$$, 'P0001', 'title_required', 'create_idea needs a title');
select throws_ok($$select public.create_idea('x', '')$$, 'P0001', 'summary_required', 'create_idea needs a summary');

-- save_idea: a change makes a version; missing sections keep their content
select is(
  public.save_idea((select idea_id from ctx), 1, 'Desert night tour', 'Guided night walks for families',
    (select cat_id from ctx), '{"problem": "No night tours nearby"}'),
  2, 'save_idea returns version 2');
select is((select count(*) from public.idea_versions where idea_id = (select idea_id from ctx)), 2::bigint, 'version 2 row written');
select is((select content from public.idea_sections where idea_id = (select idea_id from ctx) and section_key = 'problem'),
  'No night tours nearby', 'new section saved');
select is((select content from public.idea_sections where idea_id = (select idea_id from ctx) and section_key = 'value'),
  'Stars and silence', 'section missing from the call is kept');
select is(
  (select new_value -> 'changed_fields' from public.activity_log
   where idea_id = (select idea_id from ctx) and action = 'idea.edited'),
  '["summary", "category_id", "sections.problem"]'::jsonb, 'idea.edited logs the changed fields');

-- save_idea: nothing changed, no version
select is(
  public.save_idea((select idea_id from ctx), 2, 'Desert night tour', 'Guided night walks for families',
    (select cat_id from ctx), '{"problem": "No night tours nearby"}'),
  2, 'unchanged save returns the current version');
select is((select count(*) from public.idea_versions where idea_id = (select idea_id from ctx)), 2::bigint, 'unchanged save writes no version');

select throws_ok(
  $$select public.save_idea((select idea_id from ctx), 2, 'x', 'y', null, '{"bogus": "x"}')$$,
  'P0001', 'invalid_section_key', 'unknown section key refused');

-- As partner B: concurrent edit with a stale version ----------------------------------------------------

select tests.act_as('bbbbbbbb-0000-4000-8000-00000000000b', 'member-b@test.local');

select throws_ok(
  $$select public.save_idea((select idea_id from ctx), 1, 'B title', 'B summary', null, '{}')$$,
  'P0001', 'version_conflict', 'stale expected_version is refused');
select is(
  tests.error_detail($$select public.save_idea((select idea_id from ctx), 1, 'B title', 'B summary', null, '{}')$$) ->> 'version_no',
  '2', 'conflict detail has the current version');
select is(
  tests.error_detail($$select public.save_idea((select idea_id from ctx), 1, 'B title', 'B summary', null, '{}')$$) ->> 'updated_by_name',
  'member-a', 'conflict detail names who saved last');
select is((select title from public.ideas where id = (select idea_id from ctx)), 'Desert night tour', 'conflict wrote nothing');

-- "Save anyway": B resends with the current version; A's text stays in history
select is(
  public.save_idea((select idea_id from ctx), 2, 'Desert night tour', 'Guided night walks for families',
    (select cat_id from ctx), '{"value": ""}'),
  3, 'overwrite with the current version makes version 3');
select is((select count(*) from public.idea_sections where idea_id = (select idea_id from ctx) and section_key = 'value'),
  0::bigint, 'blank section value clears the section');
select is(public.save_idea((select idea_id from ctx), 3, 'Desert night tours', 'Guided night walks for families',
  (select cat_id from ctx), '{}'), 4, 'version 4');
select is(public.save_idea((select idea_id from ctx), 4, 'Desert night tours', 'Night walks, families welcome',
  (select cat_id from ctx), '{}'), 5, 'version 5');

-- restore_version: restoring version 2 after 5 makes version 6
select is(public.restore_version((select idea_id from ctx), 2), 6, 'restoring version 2 after 5 makes version 6');
select is(
  (select snapshot from public.idea_versions where idea_id = (select idea_id from ctx) and version_no = 6),
  (select snapshot from public.idea_versions where idea_id = (select idea_id from ctx) and version_no = 2),
  'version 6 has the content of version 2');
select is(
  (select restored_from_version from public.idea_versions where idea_id = (select idea_id from ctx) and version_no = 6),
  2, 'version 6 records its source');
select is((select count(*) from public.idea_versions where idea_id = (select idea_id from ctx)), 6::bigint,
  'versions 3-5 are kept');
select is((select content from public.idea_sections where idea_id = (select idea_id from ctx) and section_key = 'value'),
  'Stars and silence', 'restore brings back a cleared section');
select throws_ok($$select public.restore_version((select idea_id from ctx), 99)$$, 'P0001', 'version_not_found',
  'restoring a missing version is refused');

-- Items: questions, answers, spoofing ----------------------------------------------------------------

select tests.act_as('aaaaaaaa-0000-4000-8000-00000000000a', 'member-a@test.local');

select lives_ok(
  $$with q as (
      insert into public.items (idea_id, type, content, created_by)
      select idea_id, 'question', 'Do we need a permit?', 'bbbbbbbb-0000-4000-8000-00000000000b' from ctx
      returning id)
    update ctx set question_id = (select id from q)$$,
  'member adds a question');
select is((select question_status::text from public.items where id = (select question_id from ctx)), 'open', 'question starts open');
select is((select created_by from public.items where id = (select question_id from ctx)),
  'aaaaaaaa-0000-4000-8000-00000000000a'::uuid, 'created_by cannot be spoofed');
select throws_ok(
  $$insert into public.items (idea_id, type, content, question_status) select idea_id, 'thought', 'x', 'open' from ctx$$,
  '23514', null, 'a thought cannot carry question fields');
select lives_ok(
  $$with t as (insert into public.items (idea_id, type, content) select idea_id, 'thought', 'Try a pilot night' from ctx returning id)
    update ctx set thought_id = (select id from t)$$,
  'member adds a thought');

select tests.act_as('bbbbbbbb-0000-4000-8000-00000000000b', 'member-b@test.local');
select lives_ok(
  $$update public.items set question_status = 'answered', answer = 'Yes, from the park authority'
    where id = (select question_id from ctx)$$,
  'partner B answers the question');
select is((select answered_by from public.items where id = (select question_id from ctx)),
  'bbbbbbbb-0000-4000-8000-00000000000b'::uuid, 'answered_by is the answering partner');
select ok((select answered_at is not null from public.items where id = (select question_id from ctx)), 'answered_at is set');
select is((select count(*) from public.activity_log where entity_id = (select question_id from ctx) and action = 'question.answered'),
  1::bigint, 'question.answered logged');

-- Resources ---------------------------------------------------------------------------------------------

select lives_ok(
  $$insert into public.resources (idea_id, kind, url, title) select idea_id, 'link', 'https://parks.example', 'Parks' from ctx$$,
  'member adds a link');
select throws_ok(
  $$insert into public.resources (idea_id, kind, url) select idea_id, 'link', 'javascript:alert(1)' from ctx$$,
  '23514', null, 'non-http links are refused');
select throws_ok(
  $$insert into public.resources (idea_id, kind) select idea_id, 'file' from ctx$$,
  '23514', null, 'a file resource needs a file');

-- Decisions ---------------------------------------------------------------------------------------------

select throws_ok($$select public.record_decision((select idea_id from ctx), '  ')$$, 'P0001', 'content_required',
  'a decision needs content');
select lives_ok(
  $$update ctx set decision_id = public.record_decision((select idea_id from ctx), 'Run a pilot', 'Demand looks real',
      'Two calls', 'Call three suppliers', 'bbbbbbbb-0000-4000-8000-00000000000b', '2026-12-01', 'review')$$,
  'record_decision succeeds');
select is((select next_step from public.ideas where id = (select idea_id from ctx)), 'Call three suppliers', 'next step copied to the idea');
select is((select owner_id from public.ideas where id = (select idea_id from ctx)),
  'bbbbbbbb-0000-4000-8000-00000000000b'::uuid, 'owner copied to the idea');
select is((select next_step_due from public.ideas where id = (select idea_id from ctx)), '2026-12-01'::date, 'due date copied to the idea');
select is((select status::text from public.ideas where id = (select idea_id from ctx)), 'review', 'decision changed the status');
select is((select count(*) from public.activity_log where idea_id = (select idea_id from ctx)
  and action in ('decision.recorded', 'idea.status_changed')), 2::bigint, 'decision and status change logged');
select throws_ok($$update public.decisions set content = 'changed'$$, '42501', null, 'decision content is read-only');
select lives_ok($$update public.decisions set deleted_at = now() where id = (select decision_id from ctx)$$,
  'decision can be soft deleted');
select is((select deleted_by from public.decisions where id = (select decision_id from ctx)),
  'bbbbbbbb-0000-4000-8000-00000000000b'::uuid, 'deleted_by is stamped');

-- Status, direct writes --------------------------------------------------------------------------------

select lives_ok($$select public.set_idea_status((select idea_id from ctx), 'paused')$$, 'set_idea_status succeeds');
select is(
  (select old_value ->> 'status' from public.activity_log
   where idea_id = (select idea_id from ctx) and action = 'idea.status_changed' and new_value ->> 'status' = 'paused'),
  'review', 'status change logged with old and new');
select is((select status::text from public.ideas where id = (select idea_id from ctx)), 'paused', 'status is paused');
select throws_ok($$update public.ideas set title = 'direct'$$, '42501', null, 'ideas cannot be written directly');
select throws_ok($$delete from public.items$$, '42501', null, 'items cannot be hard deleted');
select throws_ok($$insert into public.activity_log (entity_type, action) values ('idea', 'fake')$$, '42501', null,
  'members cannot write activity_log');

-- Trash and restore ---------------------------------------------------------------------------------------

select lives_ok($$select public.trash_idea((select idea_id from ctx))$$, 'trash_idea succeeds');
select is((select count(*) from public.ideas_live where id = (select idea_id from ctx)), 0::bigint, 'trashed idea leaves ideas_live');
select is((select count(*) from public.items_live where idea_id = (select idea_id from ctx)), 0::bigint, 'its items leave items_live');
select is((select deleted_by from public.ideas where id = (select idea_id from ctx)),
  'bbbbbbbb-0000-4000-8000-00000000000b'::uuid, 'trash records who');
select throws_ok($$select public.save_idea((select idea_id from ctx), 6, 'x', 'y', null, '{}')$$, 'P0001', 'idea_not_found',
  'a trashed idea cannot be edited');
select lives_ok($$select public.restore_idea((select idea_id from ctx))$$, 'restore_idea succeeds');
select is((select count(*) from public.ideas_live where id = (select idea_id from ctx)), 1::bigint, 'restored idea is back');
select is((select count(*) from public.items_live where idea_id = (select idea_id from ctx)), 2::bigint, 'its items are back');
select is((select status::text from public.ideas where id = (select idea_id from ctx)), 'paused', 'status survives the trash');

-- Duplicate ---------------------------------------------------------------------------------------------

select lives_ok($$update ctx set dup_id = public.duplicate_idea((select idea_id from ctx), 'Copy of Desert night tours')$$,
  'duplicate_idea succeeds');
select is((select status::text from public.ideas where id = (select dup_id from ctx)), 'new', 'duplicate starts as new');
select is((select version_no from public.ideas where id = (select dup_id from ctx)), 1, 'duplicate is at version 1');
select is((select count(*) from public.idea_versions where idea_id = (select dup_id from ctx)), 1::bigint, 'duplicate has no history');
select is((select count(*) from public.items where idea_id = (select dup_id from ctx)), 0::bigint, 'duplicate has no items');
select is(
  (select snapshot -> 'sections' from public.idea_versions where idea_id = (select dup_id from ctx)),
  (select snapshot -> 'sections' from public.idea_versions where idea_id = (select idea_id from ctx) and version_no = 6),
  'duplicate copies the sections');

-- Search (ILIKE substring) --------------------------------------------------------------------------------

select ok((select count(*) from public.ideas_live where title ilike '%night tour%') >= 2, 'substring search finds ideas');

-- Profiles, settings, presence ---------------------------------------------------------------------------

select lives_ok($$update public.profiles set display_name = 'Partner B' where id = 'bbbbbbbb-0000-4000-8000-00000000000b'$$,
  'partner edits own name');
select lives_ok($$update public.profiles set display_name = 'Hacked' where id = 'aaaaaaaa-0000-4000-8000-00000000000a'$$,
  'editing another profile runs but matches no rows');
select is((select display_name from public.profiles where id = 'aaaaaaaa-0000-4000-8000-00000000000a'), 'member-a',
  'other profile unchanged');
select throws_ok($$update public.profiles set is_active = false$$, '42501', null, 'is_active is not client-writable');
select lives_ok($$update public.app_settings set value = 'after' where key = 'test_key'$$, 'member renames a setting');
select is((select updated_by from public.app_settings where key = 'test_key'),
  'bbbbbbbb-0000-4000-8000-00000000000b'::uuid, 'setting update stamped');
select lives_ok($$select public.touch_last_seen()$$, 'touch_last_seen succeeds');
select ok((select last_seen_at is not null from public.profiles where id = 'bbbbbbbb-0000-4000-8000-00000000000b'),
  'last_seen_at is set');

-- Partners ---------------------------------------------------------------------------------------------

select throws_ok($$select public.invite_partner('not-an-email')$$, 'P0001', 'invalid_email', 'invalid email refused');
select lives_ok($$select public.invite_partner('  New.Partner@Test.local ')$$, 'invite_partner succeeds');
select is((select status::text from public.allowed_emails where email = 'new.partner@test.local'), 'invited',
  'invited email stored lowercase');
select is(public.check_email_allowed('new.partner@test.local'), true, 'invited email may request a link');

select tests.act_as('aaaaaaaa-0000-4000-8000-00000000000a', 'member-a@test.local');
select lives_ok($$select public.remove_partner('member-b@test.local')$$, 'A removes B');
select is((select is_active from public.profiles where id = 'bbbbbbbb-0000-4000-8000-00000000000b'), false, 'B profile inactive');

select tests.act_as('bbbbbbbb-0000-4000-8000-00000000000b', 'member-b@test.local');
select is(public.is_member(), false, 'removed B is no longer a member');
select is((select count(*) from public.ideas), 0::bigint, 'removed B reads nothing');
select throws_ok($$select public.touch_last_seen()$$, 'P0001', 'not_a_member', 'removed B is refused at once');

select tests.act_as('aaaaaaaa-0000-4000-8000-00000000000a', 'member-a@test.local');
select throws_ok($$select public.remove_partner('member-a@test.local')$$, 'P0001', 'last_partner',
  'the last joined partner cannot be removed');
select throws_ok($$select public.remove_partner('nobody@test.local')$$, 'P0001', 'partner_not_found', 'unknown partner refused');
select lives_ok($$select public.invite_partner('member-b@test.local')$$, 'A re-invites B');
select is((select status::text from public.allowed_emails where email = 'member-b@test.local'), 'joined',
  'a returning partner is joined directly');

select tests.act_as('bbbbbbbb-0000-4000-8000-00000000000b', 'member-b@test.local');
select is(public.is_member(), true, 'B is a member again');

reset role;

select * from finish();
rollback;
