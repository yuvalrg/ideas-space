-- Tables (spec section 7) plus app_settings for the workspace name.
-- Every id is uuid, every time is timestamptz (UTC).
-- Nothing is ever lost: profiles are never deleted, content is soft deleted (deleted_at + deleted_by),
-- so foreign keys are ON DELETE RESTRICT. Phase 2 permanent delete removes children explicitly.

-- Partners. One row per auth user, created by the auth trigger on first sign-in.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  email text not null unique check (email = lower(email)),
  display_name text not null check (length(btrim(display_name)) > 0),
  avatar_url text,
  is_active boolean not null default true,
  is_admin boolean, -- unused in phase 1 (spec section 7)
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz
);

-- Source of truth for access. RLS allows a caller only when their email is here with status 'joined'.
create table public.allowed_emails (
  email text primary key check (email = lower(email) and position('@' in email) > 1),
  status public.allowed_email_status not null default 'invited',
  invited_by uuid references public.profiles (id) on delete restrict, -- null for seeded rows
  invited_at timestamptz not null default now(),
  changed_at timestamptz not null default now(),
  changed_by uuid references public.profiles (id) on delete restrict
);

-- Key/value settings. Phase 1 holds only 'workspace_name'.
create table public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete restrict
);

-- Loaded from seed.sql. Editable in the UI only in phase 2.
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text,
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) > 0),
  summary text not null,
  category_id uuid references public.categories (id) on delete restrict,
  status public.idea_status not null default 'new',
  created_by uuid not null references public.profiles (id) on delete restrict,
  owner_id uuid references public.profiles (id) on delete restrict,
  next_step text,
  next_step_due date,
  -- Optimistic locking: always equals the highest idea_versions.version_no of this idea.
  version_no int not null default 1 check (version_no >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles (id) on delete restrict,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete restrict,
  constraint ideas_soft_delete check ((deleted_at is null) = (deleted_by is null))
);

-- A row exists only while the section has content. Old content lives on in idea_versions.
create table public.idea_sections (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas (id) on delete restrict,
  section_key public.section_key not null,
  content text not null check (length(btrim(content)) > 0),
  updated_by uuid not null references public.profiles (id) on delete restrict,
  updated_at timestamptz not null default now(),
  unique (idea_id, section_key)
);

-- snapshot = {title, summary, category_id, sections: {section_key: content}}
create table public.idea_versions (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas (id) on delete restrict,
  version_no int not null check (version_no >= 1),
  snapshot jsonb not null,
  change_type public.version_change_type not null,
  restored_from_version int,
  note text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (idea_id, version_no),
  constraint idea_versions_restore_source check ((change_type = 'restore') = (restored_from_version is not null))
);

-- Uploaded file records. The bytes live in the private 'idea-files' storage bucket.
create table public.files (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas (id) on delete restrict,
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400), -- 25MB
  uploaded_by uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  -- storage_path = ideas/{idea_id}/{file_id}_{original_name}
  constraint files_storage_path check (storage_path like 'ideas/' || idea_id::text || '/%')
);

-- Shared thinking: thought / question / info.
create table public.items (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas (id) on delete restrict,
  type public.item_type not null,
  parent_id uuid references public.items (id) on delete restrict, -- phase 2 threads; null in phase 1
  content text not null check (length(btrim(content)) > 0),
  created_by uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  question_status public.question_status,
  assignee_id uuid references public.profiles (id) on delete restrict,
  answer text,
  answered_by uuid references public.profiles (id) on delete restrict,
  answered_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete restrict,
  constraint items_soft_delete check ((deleted_at is null) = (deleted_by is null)),
  -- question_* fields are filled only for questions.
  constraint items_question_fields check (
    case
      when type = 'question' then question_status is not null
      else question_status is null
        and assignee_id is null
        and answer is null
        and answered_by is null
        and answered_at is null
    end
  )
);

-- Written only through record_decision(), which also updates the idea.
create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas (id) on delete restrict,
  content text not null check (length(btrim(content)) > 0),
  reason text,
  basis text,
  next_step text,
  assignee_id uuid references public.profiles (id) on delete restrict,
  due_date date,
  new_status public.idea_status,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete restrict,
  constraint decisions_soft_delete check ((deleted_at is null) = (deleted_by is null))
);

-- Links and files attached to an idea.
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas (id) on delete restrict,
  kind public.resource_kind not null,
  title text,
  url text check (url ~* '^https?://'),
  file_id uuid references public.files (id) on delete restrict,
  description text,
  relevance text,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete restrict,
  constraint resources_soft_delete check ((deleted_at is null) = (deleted_by is null)),
  -- Exactly one of url / file_id, matching kind.
  constraint resources_target check (
    (kind = 'link' and url is not null and file_id is null)
    or (kind = 'file' and file_id is not null and url is null)
  )
);

-- Written only by triggers and functions. The client has no write privilege.
-- summary holds user content (title or snippet); the Hebrew sentence is built in the client from action.
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete restrict,
  idea_id uuid references public.ideas (id) on delete set null, -- the log row outlives a phase 2 permanent delete
  entity_type text not null,
  entity_id uuid,
  action text not null,
  summary text,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

-- Indexes (spec section 7) plus foreign key lookups.
create index ideas_list_idx on public.ideas (deleted_at, status, updated_at desc);
create index items_idea_type_status_idx on public.items (idea_id, type, question_status);
create index activity_log_created_idx on public.activity_log (created_at desc);
create index activity_log_idea_created_idx on public.activity_log (idea_id, created_at desc);
create index decisions_idea_idx on public.decisions (idea_id);
create index resources_idea_idx on public.resources (idea_id);
create index files_idea_idx on public.files (idea_id);

-- Substring search (ILIKE) on title, summary and sections (spec decision 13).
create index ideas_title_trgm_idx on public.ideas using gin (title extensions.gin_trgm_ops);
create index ideas_summary_trgm_idx on public.ideas using gin (summary extensions.gin_trgm_ops);
create index idea_sections_content_trgm_idx on public.idea_sections using gin (content extensions.gin_trgm_ops);

-- Live views hide soft-deleted rows, and children of trashed ideas.
-- security_invoker makes the caller's RLS apply; without it a view runs as its owner.
create view public.ideas_live with (security_invoker = true) as
  select i.* from public.ideas i
  where i.deleted_at is null;

create view public.items_live with (security_invoker = true) as
  select it.* from public.items it
  join public.ideas i on i.id = it.idea_id
  where it.deleted_at is null and i.deleted_at is null;

create view public.decisions_live with (security_invoker = true) as
  select d.* from public.decisions d
  join public.ideas i on i.id = d.idea_id
  where d.deleted_at is null and i.deleted_at is null;

create view public.resources_live with (security_invoker = true) as
  select r.* from public.resources r
  join public.ideas i on i.id = r.idea_id
  where r.deleted_at is null and i.deleted_at is null;
