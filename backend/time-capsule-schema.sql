create extension if not exists pgcrypto;

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
