create extension if not exists pgcrypto;

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
