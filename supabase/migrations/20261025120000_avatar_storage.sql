-- Profile pictures (spec section 5: name required, picture optional) in the same private bucket,
-- under avatars/{profile_id}/... . Members read every picture; each partner uploads only into their
-- own folder. profiles.avatar_url holds the storage path; the client opens it with a signed URL.

drop policy idea_files_member_insert on storage.objects;

create policy idea_files_member_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'idea-files'
    and (select public.is_member())
    and (
      (storage.foldername(name))[1] = 'ideas'
      or (
        (storage.foldername(name))[1] = 'avatars'
        and (storage.foldername(name))[2] = (select auth.uid())::text
      )
    )
  );
