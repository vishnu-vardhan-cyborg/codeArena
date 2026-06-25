create extension if not exists pgcrypto;

create table if not exists public.user_settings (
  user_id text primary key,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_login_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  session_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  device_name text not null,
  browser text,
  operating_system text,
  ip_address text,
  approximate_location text,
  last_active_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_login_sessions_user_active_idx
  on public.user_login_sessions (user_id, revoked_at, last_active_at desc);

-- Prototype app uses a custom lusers session with the publishable key.
-- Keep settings open until Supabase Auth and user-scoped RLS policies are added.
alter table public.user_settings disable row level security;
alter table public.user_login_sessions disable row level security;

grant select, insert, update, delete on public.user_settings to anon, authenticated;
grant select, insert, update, delete on public.user_login_sessions to anon, authenticated;

notify pgrst, 'reload schema';
