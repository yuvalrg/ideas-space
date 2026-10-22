-- Membership checks, the activity helper and the auth trigger (spec sections 5 and 11).

-- True when the caller is a joined partner with an active profile. Every RLS policy calls it.
-- SECURITY DEFINER so it can read allowed_emails / profiles without recursing into their own RLS.
create function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.allowed_emails ae
    join public.profiles p on p.email = ae.email
    where p.id = auth.uid()
      and ae.email = lower(auth.jwt() ->> 'email')
      and ae.status = 'joined'
      and p.is_active
  );
$$;

-- Called by the login page (as anon) before sending a magic link.
create function public.check_email_allowed(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.allowed_emails
    where email = lower(btrim(p_email))
      and status in ('invited', 'joined')
  );
$$;

-- Internal: one activity_log row. Only functions and triggers call it; clients cannot.
create function public.log_activity(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_idea_id uuid,
  p_summary text default null,
  p_old jsonb default null,
  p_new jsonb default null,
  p_actor uuid default auth.uid()
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.activity_log (actor_id, idea_id, entity_type, entity_id, action, summary, old_value, new_value)
  values (p_actor, p_idea_id, p_entity_type, p_entity_id, p_action, left(p_summary, 200), p_old, p_new);
$$;

-- On first sign-in: refuse emails that are not invited, create the profile, mark the email joined.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(new.email);
begin
  if v_email is null or not exists (
    select 1 from public.allowed_emails
    where email = v_email and status in ('invited', 'joined')
  ) then
    raise exception 'email_not_allowed';
  end if;

  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    v_email,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(v_email, '@', 1))
  )
  on conflict (id) do nothing;

  update public.allowed_emails
  set status = 'joined', changed_at = now(), changed_by = new.id
  where email = v_email;

  perform public.log_activity('partner.joined', 'profile', new.id, null, v_email, null, null, new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
