-- Adds public profile metadata used by signup and the profile editor.
-- Paste this in the Supabase SQL editor.

alter table public.lusers
  add column if not exists country text;

alter table public.lusers
  add column if not exists bio text;

alter table public.lusers
  add column if not exists gender text;

alter table public.lusers
  add column if not exists profile_type text;

alter table public.lusers
  add column if not exists college_name text;

alter table public.lusers
  add column if not exists organization_name text;

update public.lusers
set country = 'India'
where country is null or btrim(country) = '';

alter table public.lusers
  alter column country set default 'India';

alter table public.lusers
  alter column country set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lusers_country_length_check'
  ) then
    alter table public.lusers
      add constraint lusers_country_length_check
      check (char_length(btrim(country)) between 2 and 80);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lusers_profile_type_check'
      and conrelid = 'public.lusers'::regclass
  ) then
    alter table public.lusers
      add constraint lusers_profile_type_check
      check (
        profile_type is null
        or profile_type in ('student', 'employee', 'vibe_coder')
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lusers_college_name_length_check'
      and conrelid = 'public.lusers'::regclass
  ) then
    alter table public.lusers
      add constraint lusers_college_name_length_check
      check (college_name is null or char_length(btrim(college_name)) between 2 and 120);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lusers_organization_name_length_check'
      and conrelid = 'public.lusers'::regclass
  ) then
    alter table public.lusers
      add constraint lusers_organization_name_length_check
      check (
        organization_name is null
        or char_length(btrim(organization_name)) between 2 and 120
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lusers_profile_type_details_check'
      and conrelid = 'public.lusers'::regclass
  ) then
    alter table public.lusers
      add constraint lusers_profile_type_details_check
      check (
        profile_type is null
        or profile_type = 'vibe_coder'
        or (profile_type = 'student' and college_name is not null and btrim(college_name) <> '')
        or (
          profile_type = 'employee'
          and organization_name is not null
          and btrim(organization_name) <> ''
        )
      );
  end if;
end $$;

alter table public.lusers
  drop constraint if exists lusers_gender_check;

alter table public.lusers
  add constraint lusers_gender_check
  check (
    gender is null
    or gender in ('Male', 'Female', 'Prefer not to say')
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lusers_bio_length_check'
  ) then
    alter table public.lusers
      add constraint lusers_bio_length_check
      check (bio is null or char_length(bio) <= 280);
  end if;
end $$;
