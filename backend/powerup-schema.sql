-- Powerups, attacks, hunt rewards, and capsule activity rules.
-- Paste this into Supabase SQL editor after the existing base schemas.

create table if not exists public.powerups (
  user_id text not null,
  powerup_name text not null
    check (
      powerup_name in (
        'settle_the_bet',
        'steal',
        'shield',
        'uno_reverse',
        'streak_recover'
      )
    ),
  quantity integer not null default 0 check (quantity >= 0),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, powerup_name)
);

insert into public.powerups (user_id, powerup_name, quantity, expires_at)
select user_id, 'steal', sum(quantity)::integer, max(expires_at)
from public.powerups
where lower(regexp_replace(powerup_name, '[^a-zA-Z0-9]+', '_', 'g')) in
  ('steal_xp', 'stealxp')
group by user_id
on conflict (user_id, powerup_name) do update set
  quantity = public.powerups.quantity + excluded.quantity,
  expires_at = coalesce(public.powerups.expires_at, excluded.expires_at);

delete from public.powerups
where lower(regexp_replace(powerup_name, '[^a-zA-Z0-9]+', '_', 'g')) in
  ('steal_xp', 'stealxp');

create table if not exists public.attacks (
  id uuid primary key default gen_random_uuid(),
  attacker_id text not null,
  target_id text not null,
  capsule_id uuid references public.time_capsules(id) on delete set null,
  powerup_name text not null
    check (
      powerup_name in (
        'settle_the_bet',
        'steal',
        'shield',
        'uno_reverse',
        'streak_recover'
      )
    ),
  challenge_text text,
  problem_id text references public.problems(id) on delete set null,
  status text not null default 'pending'
    check (
      status in (
        'pending',
        'completed',
        'failed',
        'blocked',
        'reversed',
        'expired'
      )
    ),
  expires_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (attacker_id <> target_id)
);

alter table public.attacks
  add column if not exists problem_id text references public.problems(id) on delete set null;

create table if not exists public.attack_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id text not null,
  actor_id text not null,
  attack_id uuid references public.attacks(id) on delete cascade,
  capsule_id uuid references public.time_capsules(id) on delete set null,
  message text not null check (char_length(btrim(message)) between 1 and 280),
  metadata jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.capsule_activity (
  id uuid primary key default gen_random_uuid(),
  capsule_id uuid not null references public.time_capsules(id) on delete cascade,
  user_id text not null,
  activity_type text not null default 'problem_solved',
  activity_date date not null default current_date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.forest_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  reward_kind text not null
    check (reward_kind in ('xp', 'trap', 'chest', 'powerup', 'purchase')),
  amount integer not null default 0,
  powerup_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.forest_rewards
  drop constraint if exists forest_rewards_reward_kind_check;

alter table public.forest_rewards
  add constraint forest_rewards_reward_kind_check
  check (reward_kind in ('xp', 'trap', 'chest', 'powerup', 'purchase'));

alter table public.time_capsules
  add column if not exists status text not null default 'active';

alter table public.time_capsules
  add column if not exists inactive_since timestamptz;

alter table public.time_capsules
  add column if not exists expired_at timestamptz;

update public.time_capsules
set status = 'active'
where status is null or status not in ('active', 'expired');

alter table public.time_capsules
  drop constraint if exists time_capsules_status_check;

alter table public.time_capsules
  add constraint time_capsules_status_check
  check (status in ('active', 'expired'));

create index if not exists powerups_user_idx
  on public.powerups (user_id);

create index if not exists attacks_target_status_idx
  on public.attacks (target_id, status, expires_at);

create index if not exists attacks_capsule_created_idx
  on public.attacks (capsule_id, created_at desc);

create index if not exists attacks_problem_idx
  on public.attacks (problem_id);

create index if not exists attack_notifications_recipient_idx
  on public.attack_notifications (recipient_id, is_read, created_at desc);

create index if not exists capsule_activity_capsule_user_idx
  on public.capsule_activity (capsule_id, user_id, activity_date desc);

create index if not exists forest_rewards_user_created_idx
  on public.forest_rewards (user_id, created_at desc);

create index if not exists time_capsules_status_inactive_idx
  on public.time_capsules (status, inactive_since);

do $$
begin
  if to_regclass('public.social_notifications') is not null then
    alter table public.social_notifications
      drop constraint if exists social_notifications_notification_type_check;

    alter table public.social_notifications
      add constraint social_notifications_notification_type_check
      check (
        notification_type in (
          'follow',
          'friend_request',
          'post',
          'time_capsule_invite',
          'attack'
        )
      );
  end if;
end $$;

-- Prototype app uses a custom lusers session with the publishable key.
-- Keep these open until Supabase Auth/RLS policies are added.
alter table public.powerups disable row level security;
alter table public.attacks disable row level security;
alter table public.attack_notifications disable row level security;
alter table public.capsule_activity disable row level security;
alter table public.forest_rewards disable row level security;

grant select, insert, update, delete on public.powerups to anon, authenticated;
grant select, insert, update, delete on public.attacks to anon, authenticated;
grant select, insert, update, delete on public.attack_notifications to anon, authenticated;
grant select, insert, update, delete on public.capsule_activity to anon, authenticated;
grant select, insert, update, delete on public.forest_rewards to anon, authenticated;

create or replace function public.expire_inactive_time_capsules()
returns integer
language plpgsql
as $$
declare
  expired_count integer := 0;
begin
  update public.time_capsules capsule
  set
    inactive_since = coalesce(capsule.inactive_since, now())
  where capsule.status = 'active'
    and (
      select count(*)
      from public.time_capsule_members member
      where member.capsule_id = capsule.id
        and member.status = 'joined'
    ) < 2
    and capsule.inactive_since is null;

  update public.time_capsules capsule
  set inactive_since = null
  where capsule.status = 'active'
    and capsule.inactive_since is not null
    and (
      select count(*)
      from public.time_capsule_members member
      where member.capsule_id = capsule.id
        and member.status = 'joined'
    ) >= 2;

  update public.time_capsules capsule
  set
    status = 'expired',
    expired_at = now()
  where capsule.status = 'active'
    and capsule.inactive_since is not null
    and capsule.inactive_since <= now() - interval '4 days'
    and (
      select count(*)
      from public.time_capsule_members member
      where member.capsule_id = capsule.id
        and member.status = 'joined'
    ) < 2;

  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;

notify pgrst, 'reload schema';
