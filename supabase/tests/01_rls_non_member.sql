-- RLS and privileges: anon and non-members read and write nothing; a member succeeds.
-- Runs in one transaction and rolls back, so it leaves no data behind.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

-- Test helpers --------------------------------------------------------------------------------------

create schema tests;

-- An invited email plus its auth user (the auth trigger creates the profile and marks it joined).
create function tests.add_partner(p_id uuid, p_email text) returns void language plpgsql as $$
begin
  insert into public.allowed_emails (email, status) values (p_email, 'invited') on conflict (email) do nothing;
  insert into auth.users (id, email) values (p_id, p_email);
end $$;

-- Pretend the next statements come from this user's JWT (null = anonymous).
create function tests.act_as(p_id uuid, p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when p_id is null then '{"role":"anon"}'
    else json_build_object('sub', p_id, 'email', p_email, 'role', 'authenticated')::text end,
    true);
end $$;

create function tests.count_rows(p_relation text) returns bigint language plpgsql as $$
declare v bigint;
begin
  execute format('select count(*) from public.%I', p_relation) into v;
  return v;
end $$;

grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

create temp table relations (name text) on commit drop;
insert into relations values
  ('profiles'), ('allowed_emails'), ('app_settings'), ('categories'), ('ideas'), ('idea_sections'),
  ('idea_versions'), ('files'), ('items'), ('decisions'), ('resources'), ('activity_log'),
  ('ideas_live'), ('items_live'), ('decisions_live'), ('resources_live');
grant select on relations to anon, authenticated;

-- Fixture: a member with a row in every table ------------------------------------------------------

select tests.add_partner('aaaaaaaa-0000-4000-8000-00000000000a', 'member-a@test.local');
select tests.add_partner('eeeeeeee-0000-4000-8000-00000000000e', 'removed@test.local');
update public.allowed_emails set status = 'removed' where email = 'removed@test.local';
update public.profiles set is_active = false where email = 'removed@test.local';

insert into public.app_settings (key, value) values ('test_key', 'test value') on conflict (key) do nothing;
insert into public.categories (name) values ('Test category') on conflict (name) do nothing;

select tests.act_as('aaaaaaaa-0000-4000-8000-00000000000a', 'member-a@test.local');

create temp table fx on commit drop as
  select public.create_idea('Fixture idea', 'Fixture summary', null, 'Something interesting') as idea_id;
grant select on fx to anon, authenticated;

insert into public.items (idea_id, type, content) select idea_id, 'question', 'Fixture question?' from fx;
select public.record_decision((select idea_id from fx), 'Fixture decision');
insert into public.files (idea_id, storage_path, original_name, mime_type, size_bytes)
  select idea_id, 'ideas/' || idea_id || '/f_test.pdf', 'test.pdf', 'application/pdf', 100 from fx;
insert into public.resources (idea_id, kind, url, title)
  select idea_id, 'link', 'https://example.com', 'Example' from fx;

-- Anonymous (anon key only) -------------------------------------------------------------------------

select tests.act_as(null, null);
set local role anon;

select throws_ok(format('select count(*) from public.%I', name), '42501', null, format('anon cannot read %s', name))
from relations;

select is(public.check_email_allowed('Member-A@test.local '), true, 'anon: check_email_allowed true for a partner');
select is(public.check_email_allowed('stranger@test.local'), false, 'anon: check_email_allowed false for a stranger');
select throws_ok($$select public.create_idea('x', 'y')$$, '42501', null, 'anon cannot call create_idea');
select throws_ok($$select public.is_member()$$, '42501', null, 'anon cannot call is_member');

reset role;

-- Signed in, but not on the list --------------------------------------------------------------------

select tests.act_as('cccccccc-0000-4000-8000-00000000000c', 'stranger@test.local');
set local role authenticated;

select is(public.is_member(), false, 'stranger is not a member');

select is(tests.count_rows(name), 0::bigint, format('stranger sees 0 rows in %s', name))
from relations;

select throws_ok(
  $$insert into public.items (idea_id, type, content) select idea_id, 'thought', 'x' from fx$$,
  '42501', null, 'stranger cannot insert items');
select throws_ok(
  $$insert into public.resources (idea_id, kind, url) select idea_id, 'link', 'https://x.test' from fx$$,
  '42501', null, 'stranger cannot insert resources');
select throws_ok(
  $$insert into public.ideas (title, summary, created_by, updated_by)
    values ('x', 'y', 'cccccccc-0000-4000-8000-00000000000c', 'cccccccc-0000-4000-8000-00000000000c')$$,
  '42501', null, 'stranger cannot insert ideas directly');
select throws_ok(
  $$insert into public.activity_log (entity_type, action) values ('idea', 'fake')$$,
  '42501', null, 'stranger cannot write activity_log');
select lives_ok($$update public.items set content = 'hacked'$$, 'stranger update runs but matches no rows');

select throws_ok($$select public.create_idea('x', 'y')$$, 'P0001', 'not_a_member', 'stranger: create_idea refused');
select throws_ok($$select public.save_idea((select idea_id from fx), 1, 'x', 'y', null, '{}')$$,
  'P0001', 'not_a_member', 'stranger: save_idea refused');
select throws_ok($$select public.trash_idea((select idea_id from fx))$$, 'P0001', 'not_a_member', 'stranger: trash_idea refused');
select throws_ok($$select public.invite_partner('stranger@test.local')$$, 'P0001', 'not_a_member', 'stranger: invite_partner refused');
select throws_ok($$select public.touch_last_seen()$$, 'P0001', 'not_a_member', 'stranger: touch_last_seen refused');

select is((select count(*) from storage.objects where bucket_id = 'idea-files'), 0::bigint, 'stranger sees no stored files');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('idea-files', 'ideas/x/y.pdf')$$,
  '42501', null, 'stranger cannot upload files');

reset role;

-- A removed partner -----------------------------------------------------------------------------------

select tests.act_as('eeeeeeee-0000-4000-8000-00000000000e', 'removed@test.local');
set local role authenticated;

select is(public.is_member(), false, 'removed partner is not a member');
select is(tests.count_rows('ideas'), 0::bigint, 'removed partner sees 0 ideas');
select throws_ok($$select public.create_idea('x', 'y')$$, 'P0001', 'not_a_member', 'removed partner: create_idea refused');

reset role;

-- The member ----------------------------------------------------------------------------------------

select tests.act_as('aaaaaaaa-0000-4000-8000-00000000000a', 'member-a@test.local');
set local role authenticated;

select is(public.is_member(), true, 'member is a member');
select ok(tests.count_rows(name) > 0, format('member reads %s', name))
from relations;

-- Internal helpers stay closed even to members (apply_sections would skip versioning).
select throws_ok($$select public.apply_sections((select idea_id from fx), '{}'::jsonb, 'aaaaaaaa-0000-4000-8000-00000000000a')$$,
  '42501', null, 'member cannot call apply_sections');
select throws_ok($$select public.log_activity('fake', 'idea', null, null)$$, '42501', null, 'member cannot call log_activity');
select throws_ok($$select public.idea_snapshot((select idea_id from fx))$$, '42501', null, 'member cannot call idea_snapshot');
select throws_ok($$select public.handle_new_user()$$, '42501', null, 'member cannot call handle_new_user');

reset role;

-- Auth trigger, bucket, and nothing was changed by the stranger ------------------------------------

select throws_ok(
  $$insert into auth.users (id, email) values ('dddddddd-0000-4000-8000-00000000000d', 'not-invited@test.local')$$,
  'P0001', 'email_not_allowed', 'sign-up with an email not on the list is refused');
select is((select status::text from public.allowed_emails where email = 'member-a@test.local'), 'joined',
  'first sign-in marks the email joined');
select is((select display_name from public.profiles where email = 'member-a@test.local'), 'member-a',
  'first sign-in creates the profile');
select is((select count(*) from public.items where content = 'hacked'), 0::bigint, 'stranger update changed nothing');
select is((select public from storage.buckets where id = 'idea-files'), false, 'idea-files bucket is private');
select is((select file_size_limit from storage.buckets where id = 'idea-files'), 26214400::bigint, 'idea-files limit is 25MB');

select * from finish();
rollback;
