-- Partner management and presence (spec section 5).

-- Invite an email. An email whose profile already exists (a removed partner coming back) is
-- re-joined directly, since the auth trigger only runs on a user's first sign-in.
create function public.invite_partner(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(btrim(p_email));
  v_current public.allowed_email_status;
  v_profile_id uuid;
  v_status public.allowed_email_status;
begin
  if not public.is_member() then raise exception 'not_a_member'; end if;
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;

  select status into v_current from public.allowed_emails where email = v_email for update;
  if v_current = 'joined' then return; end if;

  select id into v_profile_id from public.profiles where email = v_email;
  if v_profile_id is not null then
    update public.profiles set is_active = true where id = v_profile_id;
    v_status := 'joined';
  else
    v_status := 'invited';
  end if;

  insert into public.allowed_emails as ae (email, status, invited_by, invited_at, changed_at, changed_by)
  values (v_email, v_status, v_uid, now(), now(), v_uid)
  on conflict (email) do update
    set status = excluded.status,
        invited_by = excluded.invited_by,
        invited_at = excluded.invited_at,
        changed_at = excluded.changed_at,
        changed_by = excluded.changed_by;

  perform public.log_activity('partner.invited', 'allowed_email', v_profile_id, null, v_email,
    case when v_current is null then null else jsonb_build_object('status', v_current) end,
    jsonb_build_object('status', v_status));
end;
$$;

-- Remove a partner: status 'removed', profile inactive. Their next request fails RLS.
-- Refuses to remove the last joined partner.
create function public.remove_partner(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(p_email));
  v_current public.allowed_email_status;
  v_profile_id uuid;
begin
  if not public.is_member() then raise exception 'not_a_member'; end if;

  -- Lock all joined rows so two concurrent removals cannot both pass the last-partner check.
  perform 1 from public.allowed_emails where status = 'joined' for update;

  select status into v_current from public.allowed_emails where email = v_email for update;
  if not found then raise exception 'partner_not_found'; end if;
  if v_current = 'removed' then return; end if;

  if v_current = 'joined'
    and (select count(*) from public.allowed_emails where status = 'joined') <= 1 then
    raise exception 'last_partner';
  end if;

  update public.allowed_emails
  set status = 'removed', changed_at = now(), changed_by = auth.uid()
  where email = v_email;

  update public.profiles set is_active = false where email = v_email
  returning id into v_profile_id;

  perform public.log_activity('partner.removed', 'allowed_email', v_profile_id, null, v_email,
    jsonb_build_object('status', v_current), jsonb_build_object('status', 'removed'));
end;
$$;

-- Called when the home screen loads; drives the "new since last visit" mark. Not logged.
create function public.touch_last_seen()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_member() then raise exception 'not_a_member'; end if;
  update public.profiles set last_seen_at = now() where id = auth.uid();
end;
$$;
