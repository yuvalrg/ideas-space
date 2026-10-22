-- Row Level Security, privileges and the private file bucket (spec sections 9 and 11).
-- Rule: a joined, active partner reads and edits everything; anyone else sees nothing.
-- Grants are a second layer under RLS: anon gets no table access at all.

-- RLS on every table ------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.allowed_emails enable row level security;
alter table public.app_settings enable row level security;
alter table public.categories enable row level security;
alter table public.ideas enable row level security;
alter table public.idea_sections enable row level security;
alter table public.idea_versions enable row level security;
alter table public.files enable row level security;
alter table public.items enable row level security;
alter table public.decisions enable row level security;
alter table public.resources enable row level security;
alter table public.activity_log enable row level security;

-- Read: members read every table. (select ...) lets Postgres evaluate is_member() once per query.
create policy members_read on public.profiles for select to authenticated using ((select public.is_member()));
create policy members_read on public.allowed_emails for select to authenticated using ((select public.is_member()));
create policy members_read on public.app_settings for select to authenticated using ((select public.is_member()));
create policy members_read on public.categories for select to authenticated using ((select public.is_member()));
create policy members_read on public.ideas for select to authenticated using ((select public.is_member()));
create policy members_read on public.idea_sections for select to authenticated using ((select public.is_member()));
create policy members_read on public.idea_versions for select to authenticated using ((select public.is_member()));
create policy members_read on public.files for select to authenticated using ((select public.is_member()));
create policy members_read on public.items for select to authenticated using ((select public.is_member()));
create policy members_read on public.decisions for select to authenticated using ((select public.is_member()));
create policy members_read on public.resources for select to authenticated using ((select public.is_member()));
create policy members_read on public.activity_log for select to authenticated using ((select public.is_member()));

-- Direct writes (hard rule 1): items, resources, files. Soft delete is an update; there is no
-- delete policy anywhere. ideas / idea_sections / idea_versions are written only by functions.
create policy members_insert on public.items for insert to authenticated with check ((select public.is_member()));
create policy members_update on public.items for update to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));

create policy members_insert on public.resources for insert to authenticated with check ((select public.is_member()));
create policy members_update on public.resources for update to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));

create policy members_insert on public.files for insert to authenticated with check ((select public.is_member()));

-- Decisions: soft delete / restore only (column grant below limits the columns).
create policy members_update on public.decisions for update to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));

-- Profiles: each partner edits only their own name and picture.
create policy own_profile_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) and (select public.is_member()))
  with check (id = (select auth.uid()) and (select public.is_member()));

-- Settings: any member may rename the workspace.
create policy members_update on public.app_settings for update to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));

-- Table privileges --------------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;

grant select on all tables in schema public to authenticated; -- includes the *_live views
grant insert, update on public.items, public.resources to authenticated;
grant insert on public.files to authenticated;
grant update (deleted_at, deleted_by) on public.decisions to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;
grant update (value) on public.app_settings to authenticated;

-- Function privileges -----------------------------------------------------------------------------
-- Functions are executable by PUBLIC by default; close that and open only the API.

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.check_email_allowed(text) to anon, authenticated;
grant execute on function public.is_member() to authenticated;
grant execute on function public.create_idea(text, text, uuid, text) to authenticated;
grant execute on function public.save_idea(uuid, int, text, text, uuid, jsonb) to authenticated;
grant execute on function public.restore_version(uuid, int) to authenticated;
grant execute on function public.duplicate_idea(uuid, text) to authenticated;
grant execute on function public.set_idea_status(uuid, public.idea_status) to authenticated;
grant execute on function public.record_decision(uuid, text, text, text, text, uuid, date, public.idea_status) to authenticated;
grant execute on function public.trash_idea(uuid) to authenticated;
grant execute on function public.restore_idea(uuid) to authenticated;
grant execute on function public.invite_partner(text) to authenticated;
grant execute on function public.remove_partner(text) to authenticated;
grant execute on function public.touch_last_seen() to authenticated;

-- Storage: one private bucket, members only, 25MB, allowed types (spec section 9) --------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'idea-files',
  'idea-files',
  false,
  26214400,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/heif',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Objects live under ideas/{idea_id}/...
create policy idea_files_member_read on storage.objects for select to authenticated
  using (bucket_id = 'idea-files' and (select public.is_member()));

create policy idea_files_member_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'idea-files'
    and (select public.is_member())
    and (storage.foldername(name))[1] = 'ideas'
  );

create policy idea_files_member_update on storage.objects for update to authenticated
  using (bucket_id = 'idea-files' and (select public.is_member()))
  with check (bucket_id = 'idea-files' and (select public.is_member()));

create policy idea_files_member_delete on storage.objects for delete to authenticated
  using (bucket_id = 'idea-files' and (select public.is_member()));
