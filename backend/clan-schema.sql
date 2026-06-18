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

alter table public.clans disable row level security;
alter table public.clan_members disable row level security;

grant select, insert, update, delete on public.clans to anon, authenticated;
grant select, insert, update, delete on public.clan_members to anon, authenticated;

do $$
begin
  if to_regclass('public.clan_rankings') is not null then
    execute 'grant select on public.clan_rankings to anon, authenticated';
  end if;
end $$;

notify pgrst, 'reload schema';
