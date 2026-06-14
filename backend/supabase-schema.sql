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
