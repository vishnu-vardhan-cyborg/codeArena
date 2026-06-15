create extension if not exists pgcrypto;

create table if not exists public.clans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tag text not null,
  owner_id text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists clans_name_lower_key
  on public.clans (lower(name));

create unique index if not exists clans_tag_lower_key
  on public.clans (lower(tag));

create table if not exists public.clan_members (
  clan_id uuid not null references public.clans(id) on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now(),
  primary key (clan_id, user_id)
);

create unique index if not exists clan_members_user_id_key
  on public.clan_members (user_id);

create index if not exists clan_members_clan_id_idx
  on public.clan_members (clan_id);

create table if not exists public.chat_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id text not null,
  owner_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_group_members (
  group_id uuid not null references public.chat_groups(id) on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists chat_group_members_user_id_idx
  on public.chat_group_members (user_id);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  group_id uuid references public.chat_groups(id) on delete set null,
  conversation_type text not null check (conversation_type in ('direct', 'group')),
  sender_id text not null,
  sender_name text,
  message text not null check (char_length(message) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_room_created_idx
  on public.chat_messages (room_id, created_at desc);

create index if not exists chat_messages_group_id_idx
  on public.chat_messages (group_id);

alter table public.clans disable row level security;
alter table public.clan_members disable row level security;
alter table public.chat_groups disable row level security;
alter table public.chat_group_members disable row level security;
alter table public.chat_messages disable row level security;

create table if not exists public.time_capsules (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 80),
  challenge text not null check (char_length(challenge) between 2 and 240),
  owner_id text not null,
  duration_days integer not null check (duration_days between 7 and 365),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.time_capsule_members (
  capsule_id uuid not null references public.time_capsules(id) on delete cascade,
  user_id text not null,
  invited_by text not null,
  status text not null default 'invited'
    check (status in ('invited', 'joined', 'declined')),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (capsule_id, user_id)
);

create index if not exists time_capsules_owner_id_idx
  on public.time_capsules (owner_id);

create index if not exists time_capsules_ends_at_idx
  on public.time_capsules (ends_at);

create index if not exists time_capsule_members_user_id_idx
  on public.time_capsule_members (user_id);

create index if not exists time_capsule_members_status_idx
  on public.time_capsule_members (status);

alter table public.time_capsules disable row level security;
alter table public.time_capsule_members disable row level security;

create table if not exists public.user_activity (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  activity_type text not null,
  problem_id text,
  activity_date date not null default current_date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.user_activity
  add column if not exists activity_date date;

update public.user_activity
set activity_date = created_at::date
where activity_date is null;

alter table public.user_activity
  alter column activity_date set default current_date;

alter table public.user_activity
  alter column activity_date set not null;

create index if not exists user_activity_user_date_idx
  on public.user_activity (user_id, activity_date desc);

create index if not exists user_activity_problem_id_idx
  on public.user_activity (problem_id);

alter table public.user_activity disable row level security;

notify pgrst, 'reload schema';

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
returns trigger language plpgsql as $$
begin
  insert into public.social_notifications (recipient_id, actor_id, notification_type)
  values (new.following_id, new.follower_id, 'follow');
  return new;
end;
$$;

drop trigger if exists user_follows_notify_trigger on public.user_follows;
create trigger user_follows_notify_trigger
after insert on public.user_follows
for each row execute function public.notify_new_follow();

create or replace function public.notify_friend_request()
returns trigger language plpgsql as $$
begin
  if new.status = 'pending' then
    insert into public.social_notifications (recipient_id, actor_id, notification_type)
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
returns trigger language plpgsql as $$
begin
  insert into public.social_notifications (
    recipient_id, actor_id, notification_type, post_id, metadata
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
    select case
      when friends.user1_id::text = new.user_id then friends.user2_id::text
      else friends.user1_id::text
    end
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
