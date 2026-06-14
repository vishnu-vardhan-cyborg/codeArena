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
