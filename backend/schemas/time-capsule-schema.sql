create extension if not exists pgcrypto;

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

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'social_notifications'
  ) then
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
  end if;
end $$;

create or replace function public.notify_time_capsule_invite()
returns trigger
language plpgsql
as $$
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
      recipient_id,
      actor_id,
      notification_type,
      metadata
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
