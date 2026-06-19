alter table public.posts
  add column if not exists archived_at timestamptz;

create index if not exists posts_user_archived_idx
  on public.posts (user_id, archived_at, created_at desc);

grant select, insert, update, delete on public.posts to anon, authenticated;

notify pgrst, 'reload schema';
