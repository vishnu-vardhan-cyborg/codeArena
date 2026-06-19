-- Profile picture Storage setup for the current prototype.
--
-- The frontend uses a custom lusers session and the Supabase anon key instead
-- of Supabase Auth. These policies therefore allow any client using the
-- publishable key to manage objects in the profilepics bucket. Replace them
-- with authenticated, user-folder policies before production.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'profilepics',
  'profilepics',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profilepics_public_read" on storage.objects;
drop policy if exists "profilepics_client_insert" on storage.objects;
drop policy if exists "profilepics_client_update" on storage.objects;
drop policy if exists "profilepics_client_delete" on storage.objects;

create policy "profilepics_public_read"
on storage.objects
for select
to public
using (bucket_id = 'profilepics');

create policy "profilepics_client_insert"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'profilepics');

create policy "profilepics_client_update"
on storage.objects
for update
to anon, authenticated
using (bucket_id = 'profilepics')
with check (bucket_id = 'profilepics');

create policy "profilepics_client_delete"
on storage.objects
for delete
to anon, authenticated
using (bucket_id = 'profilepics');

notify pgrst, 'reload schema';
