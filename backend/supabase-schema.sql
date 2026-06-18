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

alter table public.clan_members
  add column if not exists role text not null default 'member';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clan_members_role_check'
      and conrelid = 'public.clan_members'::regclass
  ) then
    alter table public.clan_members
      add constraint clan_members_role_check
      check (role in ('admin', 'member'));
  end if;
end $$;

update public.clan_members members
set role = 'admin'
from public.clans clans
where clans.id = members.clan_id
  and clans.owner_id = members.user_id;

create unique index if not exists clan_members_user_id_key
  on public.clan_members (user_id);

create index if not exists clan_members_clan_id_idx
  on public.clan_members (clan_id);

create index if not exists clan_members_role_idx
  on public.clan_members (clan_id, role);

do $$
begin
  if to_regclass('public.lusers') is not null
     and to_regclass('public.user_problem_progress') is not null then
    execute $view$
      create or replace view public.clan_rankings as
      with member_stats as (
        select
          members.clan_id,
          count(*)::integer as member_count,
          coalesce(sum(coalesce(users.xp, 0)), 0)::integer as total_xp
        from public.clan_members members
        left join public.lusers users
          on users.id::text = members.user_id
        group by members.clan_id
      ),
      solved_stats as (
        select
          members.clan_id,
          count(progress.problem_id)
            filter (where progress.solved_at is not null)::integer as solved_count,
          coalesce(sum(progress.attempts), 0)::integer as attempts
        from public.clan_members members
        left join public.user_problem_progress progress
          on progress.user_id = members.user_id
        group by members.clan_id
      ),
      clan_scores as (
        select
          clans.id,
          clans.name,
          clans.tag,
          clans.owner_id,
          clans.created_at,
          coalesce(member_stats.member_count, 0) as member_count,
          coalesce(member_stats.total_xp, 0) as total_xp,
          coalesce(solved_stats.solved_count, 0) as solved_count,
          coalesce(solved_stats.attempts, 0) as attempts
        from public.clans clans
        left join member_stats
          on member_stats.clan_id = clans.id
        left join solved_stats
          on solved_stats.clan_id = clans.id
      )
      select
        clan_scores.*,
        dense_rank() over (
          order by
            total_xp desc,
            solved_count desc,
            member_count desc,
            name asc
        )::integer as rank
      from clan_scores
    $view$;
  elsif to_regclass('public.lusers') is not null then
    execute $view$
      create or replace view public.clan_rankings as
      with member_stats as (
        select
          members.clan_id,
          count(*)::integer as member_count,
          coalesce(sum(coalesce(users.xp, 0)), 0)::integer as total_xp
        from public.clan_members members
        left join public.lusers users
          on users.id::text = members.user_id
        group by members.clan_id
      ),
      clan_scores as (
        select
          clans.id,
          clans.name,
          clans.tag,
          clans.owner_id,
          clans.created_at,
          coalesce(member_stats.member_count, 0) as member_count,
          coalesce(member_stats.total_xp, 0) as total_xp,
          0::integer as solved_count,
          0::integer as attempts
        from public.clans clans
        left join member_stats
          on member_stats.clan_id = clans.id
      )
      select
        clan_scores.*,
        dense_rank() over (
          order by
            total_xp desc,
            member_count desc,
            name asc
        )::integer as rank
      from clan_scores
    $view$;
  end if;
end $$;

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

grant select, insert, update, delete on public.clans to anon, authenticated;
grant select, insert, update, delete on public.clan_members to anon, authenticated;

do $$
begin
  if to_regclass('public.clan_rankings') is not null then
    execute 'grant select on public.clan_rankings to anon, authenticated';
  end if;
end $$;

create table if not exists public.time_capsules (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 80),
  challenge text not null check (char_length(challenge) between 2 and 240),
  owner_id text not null,
  duration_days integer not null check (duration_days between 7 and 365),
  visibility text not null default 'private'
    check (visibility in ('private', 'public')),
  room_code text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

alter table public.time_capsules
  add column if not exists visibility text not null default 'private';

alter table public.time_capsules
  add column if not exists room_code text;

update public.time_capsules
set visibility = 'private'
where visibility is null or visibility not in ('private', 'public');

alter table public.time_capsules
  alter column visibility set default 'private';

alter table public.time_capsules
  alter column visibility set not null;

update public.time_capsules
set room_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
where room_code is null or btrim(room_code) = '';

alter table public.time_capsules
  alter column room_code set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'time_capsules_visibility_check'
      and conrelid = 'public.time_capsules'::regclass
  ) then
    alter table public.time_capsules
      add constraint time_capsules_visibility_check
      check (visibility in ('private', 'public'));
  end if;
end $$;

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

create table if not exists public.time_capsule_messages (
  id uuid primary key default gen_random_uuid(),
  capsule_id uuid not null references public.time_capsules(id) on delete cascade,
  sender_id text not null,
  sender_name text,
  message text not null check (char_length(btrim(message)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists time_capsules_owner_id_idx
  on public.time_capsules (owner_id);

create index if not exists time_capsules_ends_at_idx
  on public.time_capsules (ends_at);

create unique index if not exists time_capsules_room_code_uidx
  on public.time_capsules (room_code);

create index if not exists time_capsule_members_user_id_idx
  on public.time_capsule_members (user_id);

create index if not exists time_capsule_members_status_idx
  on public.time_capsule_members (status);

create index if not exists time_capsule_messages_capsule_created_idx
  on public.time_capsule_messages (capsule_id, created_at);

alter table public.time_capsules disable row level security;
alter table public.time_capsule_members disable row level security;
alter table public.time_capsule_messages disable row level security;

grant select, insert, update, delete on public.time_capsules to anon, authenticated;
grant select, insert, update, delete on public.time_capsule_members to anon, authenticated;
grant select, insert, delete on public.time_capsule_messages to anon, authenticated;

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

do $$
begin
  if to_regclass('public.lusers') is not null then
    execute 'alter table public.lusers add column if not exists gender text';
    execute 'alter table public.lusers drop constraint if exists lusers_gender_check';
    execute $constraint$
      alter table public.lusers
        add constraint lusers_gender_check
        check (
          gender is null
          or gender in ('Male', 'Female', 'Prefer not to say')
        )
    $constraint$;
  end if;
end $$;

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
    check (
      notification_type in (
        'follow',
        'friend_request',
        'post',
        'time_capsule_invite'
      )
    ),
  post_id uuid references public.posts(id) on delete cascade,
  metadata jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  check (recipient_id <> actor_id)
);

alter table public.social_notifications
  drop constraint if exists social_notifications_notification_type_check;

alter table public.social_notifications
  add constraint social_notifications_notification_type_check
  check (
    notification_type in (
      'follow',
      'friend_request',
      'post',
      'time_capsule_invite'
    )
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

create or replace function public.notify_time_capsule_invite()
returns trigger language plpgsql as $$
declare
  capsule_title text;
  capsule_room_code text;
begin
  if to_regclass('public.social_notifications') is null then
    return new;
  end if;

  if new.status = 'invited' then
    select title, room_code
    into capsule_title, capsule_room_code
    from public.time_capsules
    where id = new.capsule_id;

    insert into public.social_notifications (
      recipient_id, actor_id, notification_type, metadata
    )
    values (
      new.user_id,
      new.invited_by,
      'time_capsule_invite',
      jsonb_build_object(
        'capsuleId', new.capsule_id,
        'capsuleTitle', capsule_title,
        'roomCode', capsule_room_code
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists time_capsule_invite_notify_trigger
  on public.time_capsule_members;
create trigger time_capsule_invite_notify_trigger
after insert on public.time_capsule_members
for each row execute function public.notify_time_capsule_invite();

notify pgrst, 'reload schema';
