-- Triggers for the tables the client writes directly: items, resources, files, decisions
-- (soft delete only), app_settings. BEFORE triggers stamp who/when so the client cannot spoof them;
-- AFTER triggers write activity_log (SECURITY DEFINER, since clients cannot insert there).

-- items ------------------------------------------------------------------------------------------

create function public.items_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.created_at := now();
    if new.type = 'question' and new.question_status is null then
      new.question_status := 'open';
    end if;
  else
    -- Identity columns never change after insert.
    new.idea_id := old.idea_id;
    new.type := old.type;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    if new.question_status = 'answered' and old.question_status is distinct from 'answered' then
      new.answered_by := coalesce(auth.uid(), new.answered_by);
      new.answered_at := now();
    end if;
  end if;

  if new.deleted_at is null then
    new.deleted_by := null;
  elsif tg_op = 'INSERT' or old.deleted_at is null then
    new.deleted_at := now();
    new.deleted_by := coalesce(auth.uid(), new.deleted_by);
  end if;

  new.updated_by := coalesce(auth.uid(), new.updated_by);
  new.updated_at := now();
  return new;
end;
$$;

create function public.items_after_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity('item.created', new.type::text, new.id, new.idea_id, new.content);
  elsif new.deleted_at is not null and old.deleted_at is null then
    perform public.log_activity('item.deleted', new.type::text, new.id, new.idea_id, new.content);
  elsif new.deleted_at is null and old.deleted_at is not null then
    perform public.log_activity('item.restored', new.type::text, new.id, new.idea_id, new.content);
  elsif new.question_status = 'answered' and old.question_status is distinct from 'answered' then
    perform public.log_activity('question.answered', 'question', new.id, new.idea_id, new.content,
      null, jsonb_build_object('answer', new.answer));
  elsif new.question_status is distinct from old.question_status
    or new.assignee_id is distinct from old.assignee_id
    or new.content is distinct from old.content
    or new.answer is distinct from old.answer then
    perform public.log_activity('item.edited', new.type::text, new.id, new.idea_id, new.content,
      jsonb_build_object('content', old.content, 'question_status', old.question_status,
        'assignee_id', old.assignee_id, 'answer', old.answer),
      jsonb_build_object('content', new.content, 'question_status', new.question_status,
        'assignee_id', new.assignee_id, 'answer', new.answer));
  end if;
  return null;
end;
$$;

create trigger items_before_write
  before insert or update on public.items
  for each row execute function public.items_before_write();

create trigger items_after_write
  after insert or update on public.items
  for each row execute function public.items_after_write();

-- resources --------------------------------------------------------------------------------------

create function public.resources_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.created_at := now();
  else
    new.idea_id := old.idea_id;
    new.kind := old.kind;
    new.url := case when old.kind = 'link' then new.url else old.url end;
    new.file_id := old.file_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;

  if new.deleted_at is null then
    new.deleted_by := null;
  elsif tg_op = 'INSERT' or old.deleted_at is null then
    new.deleted_at := now();
    new.deleted_by := coalesce(auth.uid(), new.deleted_by);
  end if;
  return new;
end;
$$;

create function public.resources_after_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text := coalesce(new.title, new.url);
begin
  if tg_op = 'INSERT' then
    perform public.log_activity('resource.added', 'resource', new.id, new.idea_id, v_label,
      null, jsonb_build_object('kind', new.kind));
  elsif new.deleted_at is not null and old.deleted_at is null then
    perform public.log_activity('resource.deleted', 'resource', new.id, new.idea_id, v_label);
  elsif new.deleted_at is null and old.deleted_at is not null then
    perform public.log_activity('resource.restored', 'resource', new.id, new.idea_id, v_label);
  elsif row(new.title, new.url, new.description, new.relevance)
    is distinct from row(old.title, old.url, old.description, old.relevance) then
    perform public.log_activity('resource.edited', 'resource', new.id, new.idea_id, v_label,
      jsonb_build_object('title', old.title, 'url', old.url, 'description', old.description, 'relevance', old.relevance),
      jsonb_build_object('title', new.title, 'url', new.url, 'description', new.description, 'relevance', new.relevance));
  end if;
  return null;
end;
$$;

create trigger resources_before_write
  before insert or update on public.resources
  for each row execute function public.resources_before_write();

create trigger resources_after_write
  after insert or update on public.resources
  for each row execute function public.resources_after_write();

-- files (insert only; the resource row that points at it is what gets logged) ----------------------

create function public.files_before_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.uploaded_by := coalesce(auth.uid(), new.uploaded_by);
  new.created_at := now();
  return new;
end;
$$;

create trigger files_before_insert
  before insert on public.files
  for each row execute function public.files_before_insert();

-- decisions (clients may only soft delete / restore; inserts go through record_decision) ----------

create function public.decisions_before_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.deleted_at is null then
    new.deleted_by := null;
  elsif old.deleted_at is null then
    new.deleted_at := now();
    new.deleted_by := coalesce(auth.uid(), new.deleted_by);
  end if;
  return new;
end;
$$;

create function public.decisions_after_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    perform public.log_activity('decision.deleted', 'decision', new.id, new.idea_id, new.content);
  elsif new.deleted_at is null and old.deleted_at is not null then
    perform public.log_activity('decision.restored', 'decision', new.id, new.idea_id, new.content);
  end if;
  return null;
end;
$$;

create trigger decisions_before_update
  before update on public.decisions
  for each row execute function public.decisions_before_update();

create trigger decisions_after_update
  after update on public.decisions
  for each row execute function public.decisions_after_update();

-- app_settings -----------------------------------------------------------------------------------

create function public.app_settings_before_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

create function public.app_settings_after_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.value is distinct from old.value then
    perform public.log_activity('settings.updated', 'app_settings', null, null, new.key,
      jsonb_build_object('value', old.value), jsonb_build_object('value', new.value));
  end if;
  return null;
end;
$$;

create trigger app_settings_before_update
  before update on public.app_settings
  for each row execute function public.app_settings_before_update();

create trigger app_settings_after_update
  after update on public.app_settings
  for each row execute function public.app_settings_after_update();
