create extension if not exists pgcrypto;

create table if not exists public.user_follows (
  follower_id text not null,
  following_id text not null,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists user_follows_following_id_idx
  on public.user_follows (following_id, created_at desc);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  content text not null check (char_length(content) between 1 and 2000),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.posts
  add column if not exists archived_at timestamptz;

create index if not exists posts_user_created_idx
  on public.posts (user_id, created_at desc);

create index if not exists posts_user_archived_idx
  on public.posts (user_id, archived_at, created_at desc);

create table if not exists public.social_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id text not null,
  actor_id text not null,
  notification_type text not null
    check (notification_type in ('follow', 'friend_request', 'post')),
  post_id uuid references public.posts(id) on delete cascade,
  metadata jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  check (recipient_id <> actor_id)
);

-- The current frontend uses the Supabase publishable/anon key with a custom
-- lusers session instead of Supabase Auth. Keep these prototype tables open
-- until the app migrates to Supabase Auth and user-scoped RLS policies.
alter table public.user_follows disable row level security;
alter table public.posts disable row level security;
alter table public.social_notifications disable row level security;

grant select, insert, update, delete on public.user_follows to anon, authenticated;
grant select, insert, update, delete on public.posts to anon, authenticated;
grant select, insert, update, delete on public.social_notifications to anon, authenticated;

create index if not exists social_notifications_recipient_created_idx
  on public.social_notifications (recipient_id, created_at desc);

create or replace function public.notify_new_follow()
returns trigger
language plpgsql
as $$
begin
  insert into public.social_notifications (
    recipient_id,
    actor_id,
    notification_type
  )
  values (new.following_id, new.follower_id, 'follow');

  return new;
end;
$$;

drop trigger if exists user_follows_notify_trigger on public.user_follows;
create trigger user_follows_notify_trigger
after insert on public.user_follows
for each row execute function public.notify_new_follow();

create or replace function public.notify_friend_request()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'pending' then
    insert into public.social_notifications (
      recipient_id,
      actor_id,
      notification_type
    )
    values (new.receiver_id::text, new.sender_id::text, 'friend_request');
  end if;

  return new;
end;
$$;

drop trigger if exists friend_requests_notify_trigger on public.friend_requests;
create trigger friend_requests_notify_trigger
after insert on public.friend_requests
for each row execute function public.notify_friend_request();

create or replace function public.notify_new_post()
returns trigger
language plpgsql
as $$
begin
  insert into public.social_notifications (
    recipient_id,
    actor_id,
    notification_type,
    post_id,
    metadata
  )
  select
    recipients.recipient_id,
    new.user_id,
    'post',
    new.id,
    jsonb_build_object('preview', left(new.content, 180))
  from (
    select following.follower_id as recipient_id
    from public.user_follows following
    where following.following_id = new.user_id

    union

    select
      case
        when friends.user1_id::text = new.user_id then friends.user2_id::text
        else friends.user1_id::text
      end as recipient_id
    from public.friends friends
    where friends.user1_id::text = new.user_id
       or friends.user2_id::text = new.user_id
  ) recipients
  where recipients.recipient_id <> new.user_id;

  return new;
end;
$$;

drop trigger if exists posts_notify_trigger on public.posts;
create trigger posts_notify_trigger
after insert on public.posts
for each row execute function public.notify_new_post();

notify pgrst, 'reload schema';
