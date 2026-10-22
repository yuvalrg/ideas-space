-- Multi-step writes as database functions (spec section 8, PLAN.md "Database contracts").
-- Every function: SECURITY DEFINER, fixed search_path, membership check first, activity_log in the
-- same transaction. Errors are short machine codes; the client maps them to Hebrew via he.json.

-- Internal: the versioned state of an idea, {title, summary, category_id, sections: {key: content}}.
create function public.idea_snapshot(p_idea_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'title', i.title,
    'summary', i.summary,
    'category_id', i.category_id,
    'sections', coalesce(
      (select jsonb_object_agg(s.section_key::text, s.content)
       from public.idea_sections s
       where s.idea_id = i.id),
      '{}'::jsonb
    )
  )
  from public.ideas i
  where i.id = p_idea_id;
$$;

-- Internal: make idea_sections match a {section_key: content} object.
create function public.apply_sections(p_idea_id uuid, p_sections jsonb, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.idea_sections
  where idea_id = p_idea_id
    and not (p_sections ? section_key::text);

  insert into public.idea_sections as s (idea_id, section_key, content, updated_by, updated_at)
  select p_idea_id, e.key::public.section_key, e.value, p_actor, now()
  from jsonb_each_text(p_sections) e
  on conflict (idea_id, section_key) do update
    set content = excluded.content, updated_by = excluded.updated_by, updated_at = excluded.updated_at
    where s.content is distinct from excluded.content;
end;
$$;

-- Create an idea at version 1. p_interesting is stored as the 'value' section.
create function public.create_idea(
  p_title text,
  p_summary text,
  p_category_id uuid default null,
  p_interesting text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if not public.is_member() then raise exception 'not_a_member'; end if;
  if nullif(btrim(p_title), '') is null then raise exception 'title_required'; end if;
  if nullif(btrim(p_summary), '') is null then raise exception 'summary_required'; end if;

  insert into public.ideas (title, summary, category_id, created_by, updated_by)
  values (btrim(p_title), btrim(p_summary), p_category_id, v_uid, v_uid)
  returning id into v_id;

  if nullif(btrim(p_interesting), '') is not null then
    insert into public.idea_sections (idea_id, section_key, content, updated_by)
    values (v_id, 'value', p_interesting, v_uid);
  end if;

  insert into public.idea_versions (idea_id, version_no, snapshot, change_type, created_by)
  values (v_id, 1, public.idea_snapshot(v_id), 'create', v_uid);

  perform public.log_activity('idea.created', 'idea', v_id, v_id, btrim(p_title));
  return v_id;
end;
$$;

-- Save title, summary, category and sections. Rejects a stale expected_version (version_conflict,
-- detail = JSON with who and when). Returns the current version number; no new version when nothing
-- changed. Sections missing from p_sections keep their content; a blank or null value clears one.
create function public.save_idea(
  p_idea_id uuid,
  p_expected_version int,
  p_title text,
  p_summary text,
  p_category_id uuid,
  p_sections jsonb default '{}'::jsonb
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_idea public.ideas%rowtype;
  v_old jsonb;
  v_new jsonb;
  v_sections jsonb;
  v_key text;
  v_content text;
  v_changed text[] := '{}';
begin
  if not public.is_member() then raise exception 'not_a_member'; end if;

  select * into v_idea from public.ideas where id = p_idea_id and deleted_at is null for update;
  if not found then raise exception 'idea_not_found'; end if;

  if v_idea.version_no <> p_expected_version then
    raise exception 'version_conflict' using detail = jsonb_build_object(
      'version_no', v_idea.version_no,
      'updated_by', v_idea.updated_by,
      'updated_by_name', (select display_name from public.profiles where id = v_idea.updated_by),
      'updated_at', v_idea.updated_at
    )::text;
  end if;

  if nullif(btrim(p_title), '') is null then raise exception 'title_required'; end if;
  if nullif(btrim(p_summary), '') is null then raise exception 'summary_required'; end if;

  p_sections := coalesce(p_sections, '{}'::jsonb);
  if jsonb_typeof(p_sections) <> 'object' then raise exception 'invalid_sections'; end if;
  for v_key in select jsonb_object_keys(p_sections) loop
    if not v_key = any (enum_range(null::public.section_key)::text[]) then
      raise exception 'invalid_section_key' using detail = v_key;
    end if;
  end loop;

  v_old := public.idea_snapshot(p_idea_id);
  v_sections := v_old -> 'sections';
  for v_key, v_content in select e.key, e.value from jsonb_each_text(p_sections) e loop
    if nullif(btrim(coalesce(v_content, '')), '') is null then
      v_sections := v_sections - v_key;
    else
      v_sections := v_sections || jsonb_build_object(v_key, v_content);
    end if;
  end loop;

  v_new := jsonb_build_object(
    'title', btrim(p_title),
    'summary', btrim(p_summary),
    'category_id', p_category_id,
    'sections', v_sections
  );

  if v_new = v_old then
    return v_idea.version_no;
  end if;

  if v_new -> 'title' is distinct from v_old -> 'title' then v_changed := array_append(v_changed, 'title'); end if;
  if v_new -> 'summary' is distinct from v_old -> 'summary' then v_changed := array_append(v_changed, 'summary'); end if;
  if v_new -> 'category_id' is distinct from v_old -> 'category_id' then v_changed := array_append(v_changed, 'category_id'); end if;
  for v_key in
    select k from jsonb_object_keys(v_old -> 'sections') k
    union
    select k from jsonb_object_keys(v_sections) k
    order by 1
  loop
    if (v_old -> 'sections' -> v_key) is distinct from (v_sections -> v_key) then
      v_changed := array_append(v_changed, 'sections.' || v_key);
    end if;
  end loop;

  update public.ideas
  set title = btrim(p_title),
      summary = btrim(p_summary),
      category_id = p_category_id,
      version_no = version_no + 1,
      updated_at = now(),
      updated_by = v_uid
  where id = p_idea_id;

  perform public.apply_sections(p_idea_id, v_sections, v_uid);

  insert into public.idea_versions (idea_id, version_no, snapshot, change_type, created_by)
  values (p_idea_id, v_idea.version_no + 1, v_new, 'edit', v_uid);

  perform public.log_activity('idea.edited', 'idea', p_idea_id, p_idea_id, btrim(p_title),
    jsonb_build_object('version_no', v_idea.version_no),
    jsonb_build_object('version_no', v_idea.version_no + 1, 'changed_fields', to_jsonb(v_changed)));

  return v_idea.version_no + 1;
end;
$$;

-- Apply an old snapshot as a new version. Items, decisions, resources and status are untouched.
create function public.restore_version(p_idea_id uuid, p_version_no int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_idea public.ideas%rowtype;
  v_snap jsonb;
begin
  if not public.is_member() then raise exception 'not_a_member'; end if;

  select * into v_idea from public.ideas where id = p_idea_id and deleted_at is null for update;
  if not found then raise exception 'idea_not_found'; end if;

  select snapshot into v_snap from public.idea_versions where idea_id = p_idea_id and version_no = p_version_no;
  if not found then raise exception 'version_not_found'; end if;

  update public.ideas
  set title = v_snap ->> 'title',
      summary = v_snap ->> 'summary',
      category_id = (v_snap ->> 'category_id')::uuid,
      version_no = version_no + 1,
      updated_at = now(),
      updated_by = v_uid
  where id = p_idea_id;

  perform public.apply_sections(p_idea_id, coalesce(v_snap -> 'sections', '{}'::jsonb), v_uid);

  insert into public.idea_versions (idea_id, version_no, snapshot, change_type, restored_from_version, created_by)
  values (p_idea_id, v_idea.version_no + 1, public.idea_snapshot(p_idea_id), 'restore', p_version_no, v_uid);

  perform public.log_activity('idea.restored', 'idea', p_idea_id, p_idea_id, v_snap ->> 'title',
    jsonb_build_object('version_no', v_idea.version_no),
    jsonb_build_object('version_no', v_idea.version_no + 1, 'restored_from_version', p_version_no));

  return v_idea.version_no + 1;
end;
$$;

-- New idea from the current snapshot: status 'new', version 1, no history, no items.
-- The client passes the new title (Hebrew "copy of" prefix comes from he.json).
create function public.duplicate_idea(p_idea_id uuid, p_title text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_src public.ideas%rowtype;
  v_id uuid;
begin
  if not public.is_member() then raise exception 'not_a_member'; end if;

  select * into v_src from public.ideas where id = p_idea_id and deleted_at is null;
  if not found then raise exception 'idea_not_found'; end if;
  if nullif(btrim(p_title), '') is null then raise exception 'title_required'; end if;

  insert into public.ideas (title, summary, category_id, created_by, updated_by)
  values (btrim(p_title), v_src.summary, v_src.category_id, v_uid, v_uid)
  returning id into v_id;

  insert into public.idea_sections (idea_id, section_key, content, updated_by)
  select v_id, s.section_key, s.content, v_uid
  from public.idea_sections s
  where s.idea_id = p_idea_id;

  insert into public.idea_versions (idea_id, version_no, snapshot, change_type, note, created_by)
  values (v_id, 1, public.idea_snapshot(v_id), 'create', 'duplicate_of:' || p_idea_id::text, v_uid);

  perform public.log_activity('idea.duplicated', 'idea', v_id, v_id, btrim(p_title),
    null, jsonb_build_object('source_idea_id', p_idea_id));
  return v_id;
end;
$$;

-- Free transition between any two statuses, logged with old and new.
create function public.set_idea_status(p_idea_id uuid, p_status public.idea_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_idea public.ideas%rowtype;
begin
  if not public.is_member() then raise exception 'not_a_member'; end if;
  if p_status is null then raise exception 'status_required'; end if;

  select * into v_idea from public.ideas where id = p_idea_id and deleted_at is null for update;
  if not found then raise exception 'idea_not_found'; end if;
  if v_idea.status = p_status then return; end if;

  update public.ideas
  set status = p_status, updated_at = now(), updated_by = auth.uid()
  where id = p_idea_id;

  perform public.log_activity('idea.status_changed', 'idea', p_idea_id, p_idea_id, v_idea.title,
    jsonb_build_object('status', v_idea.status), jsonb_build_object('status', p_status));
end;
$$;

-- Record a decision. next_step / assignee / due date are copied to the idea when given, and the
-- idea's status changes when p_new_status is given.
create function public.record_decision(
  p_idea_id uuid,
  p_content text,
  p_reason text default null,
  p_basis text default null,
  p_next_step text default null,
  p_assignee_id uuid default null,
  p_due_date date default null,
  p_new_status public.idea_status default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_idea public.ideas%rowtype;
  v_id uuid;
  v_next_step text := nullif(btrim(p_next_step), '');
begin
  if not public.is_member() then raise exception 'not_a_member'; end if;
  if nullif(btrim(p_content), '') is null then raise exception 'content_required'; end if;

  select * into v_idea from public.ideas where id = p_idea_id and deleted_at is null for update;
  if not found then raise exception 'idea_not_found'; end if;

  insert into public.decisions (idea_id, content, reason, basis, next_step, assignee_id, due_date, new_status, created_by)
  values (p_idea_id, p_content, nullif(btrim(p_reason), ''), nullif(btrim(p_basis), ''), v_next_step,
          p_assignee_id, p_due_date, p_new_status, v_uid)
  returning id into v_id;

  update public.ideas
  set next_step = coalesce(v_next_step, next_step),
      owner_id = coalesce(p_assignee_id, owner_id),
      next_step_due = coalesce(p_due_date, next_step_due),
      status = coalesce(p_new_status, status),
      updated_at = now(),
      updated_by = v_uid
  where id = p_idea_id;

  perform public.log_activity('decision.recorded', 'decision', v_id, p_idea_id, p_content, null,
    jsonb_build_object('next_step', v_next_step, 'assignee_id', p_assignee_id,
      'due_date', p_due_date, 'new_status', p_new_status));

  if p_new_status is not null and p_new_status <> v_idea.status then
    perform public.log_activity('idea.status_changed', 'idea', p_idea_id, p_idea_id, v_idea.title,
      jsonb_build_object('status', v_idea.status), jsonb_build_object('status', p_new_status));
  end if;

  return v_id;
end;
$$;

-- Move an idea to the trash (soft delete). Its items, resources and files stay.
create function public.trash_idea(p_idea_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_idea public.ideas%rowtype;
begin
  if not public.is_member() then raise exception 'not_a_member'; end if;

  select * into v_idea from public.ideas where id = p_idea_id for update;
  if not found then raise exception 'idea_not_found'; end if;
  if v_idea.deleted_at is not null then return; end if;

  update public.ideas set deleted_at = now(), deleted_by = auth.uid() where id = p_idea_id;

  perform public.log_activity('idea.trashed', 'idea', p_idea_id, p_idea_id, v_idea.title,
    jsonb_build_object('status', v_idea.status), null);
end;
$$;

-- Bring an idea back from the trash, with its questions and resources.
create function public.restore_idea(p_idea_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_idea public.ideas%rowtype;
begin
  if not public.is_member() then raise exception 'not_a_member'; end if;

  select * into v_idea from public.ideas where id = p_idea_id for update;
  if not found then raise exception 'idea_not_found'; end if;
  if v_idea.deleted_at is null then return; end if;

  update public.ideas set deleted_at = null, deleted_by = null where id = p_idea_id;

  perform public.log_activity('idea.restored_from_trash', 'idea', p_idea_id, p_idea_id, v_idea.title);
end;
$$;
