-- Adds optional gender metadata to the custom lusers profile table.
-- Paste this in the Supabase SQL editor before using gender in signup/profile.

alter table public.lusers
  add column if not exists gender text;

alter table public.lusers
  drop constraint if exists lusers_gender_check;

alter table public.lusers
  add constraint lusers_gender_check
  check (
    gender is null
    or gender in ('Male', 'Female', 'Prefer not to say')
  );

notify pgrst, 'reload schema';
