-- Aura Farming schema for CodeArena.
-- This version uses the app's custom lusers session and stores user ids as text.

create extension if not exists pgcrypto;

create table if not exists public.creations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  type text not null default 'project'
    check (
      type in (
        'project',
        'research_note',
        'experiment',
        'blog',
        'code_snippet',
        'case_study',
        'learning_log',
        'tool_mini_app',
        'open_source_contribution',
        'resume_portfolio_item'
      )
    ),
  title text not null,
  short_description text not null,
  problem_statement text,
  solution_description text,
  how_it_works text,
  tech_stack text[] not null default '{}'::text[],
  tags text[] not null default '{}'::text[],
  cover_image_url text,
  screenshots text[] not null default '{}'::text[],
  github_url text,
  demo_url text,
  report_url text,
  research_notes text,
  challenges_faced text,
  future_improvements text,
  aura_score integer not null default 0,
  stars_count integer not null default 0,
  saves_count integer not null default 0,
  aura_plus_count integer not null default 0,
  insightful_count integer not null default 0,
  useful_count integer not null default 0,
  innovative_count integer not null default 0,
  hire_worthy_count integer not null default 0,
  dislikes_count integer not null default 0,
  comments_count integer not null default 0,
  reviews_count integer not null default 0,
  average_rating numeric not null default 0,
  is_featured boolean not null default false,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.creations
  add column if not exists user_id text;

alter table public.creations
  add column if not exists type text not null default 'project';

alter table public.creations
  add column if not exists title text;

alter table public.creations
  add column if not exists short_description text;

alter table public.creations
  add column if not exists problem_statement text;

alter table public.creations
  add column if not exists solution_description text;

alter table public.creations
  add column if not exists how_it_works text;

alter table public.creations
  add column if not exists tech_stack text[] not null default '{}'::text[];

alter table public.creations
  add column if not exists tags text[] not null default '{}'::text[];

alter table public.creations
  add column if not exists cover_image_url text;

alter table public.creations
  add column if not exists screenshots text[] not null default '{}'::text[];

alter table public.creations
  add column if not exists github_url text;

alter table public.creations
  add column if not exists demo_url text;

alter table public.creations
  add column if not exists report_url text;

alter table public.creations
  add column if not exists research_notes text;

alter table public.creations
  add column if not exists challenges_faced text;

alter table public.creations
  add column if not exists future_improvements text;

alter table public.creations
  add column if not exists aura_score integer not null default 0;

alter table public.creations
  add column if not exists stars_count integer not null default 0;

alter table public.creations
  add column if not exists saves_count integer not null default 0;

alter table public.creations
  add column if not exists aura_plus_count integer not null default 0;

alter table public.creations
  add column if not exists insightful_count integer not null default 0;

alter table public.creations
  add column if not exists useful_count integer not null default 0;

alter table public.creations
  add column if not exists innovative_count integer not null default 0;

alter table public.creations
  add column if not exists hire_worthy_count integer not null default 0;

alter table public.creations
  add column if not exists dislikes_count integer not null default 0;

alter table public.creations
  add column if not exists comments_count integer not null default 0;

alter table public.creations
  add column if not exists reviews_count integer not null default 0;

alter table public.creations
  add column if not exists average_rating numeric not null default 0;

alter table public.creations
  add column if not exists is_featured boolean not null default false;

alter table public.creations
  add column if not exists is_public boolean not null default true;

alter table public.creations
  add column if not exists created_at timestamptz not null default now();

alter table public.creations
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.creation_reactions (
  id uuid primary key default gen_random_uuid(),
  creation_id uuid not null references public.creations(id) on delete cascade,
  user_id text not null,
  reaction text not null
    check (
      reaction in (
        'star',
        'save',
        'aura_plus',
        'insightful',
        'useful',
        'innovative',
        'hire_worthy',
        'dislike'
      )
    ),
  created_at timestamptz not null default now(),
  unique (creation_id, user_id, reaction)
);

create table if not exists public.creation_ratings (
  id uuid primary key default gen_random_uuid(),
  creation_id uuid not null references public.creations(id) on delete cascade,
  user_id text not null,
  originality integer not null default 5 check (originality between 1 and 5),
  usefulness integer not null default 5 check (usefulness between 1 and 5),
  technical_depth integer not null default 5 check (technical_depth between 1 and 5),
  presentation integer not null default 5 check (presentation between 1 and 5),
  research_quality integer not null default 5 check (research_quality between 1 and 5),
  real_world_impact integer not null default 5 check (real_world_impact between 1 and 5),
  code_quality integer not null default 5 check (code_quality between 1 and 5),
  review_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (creation_id, user_id)
);

create table if not exists public.creation_comments (
  id uuid primary key default gen_random_uuid(),
  creation_id uuid not null references public.creations(id) on delete cascade,
  user_id text not null,
  comment text not null check (char_length(btrim(comment)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recruiter_bookmarks (
  id uuid primary key default gen_random_uuid(),
  creation_id uuid not null references public.creations(id) on delete cascade,
  recruiter_id text not null,
  note text,
  created_at timestamptz not null default now(),
  unique (creation_id, recruiter_id)
);

create table if not exists public.user_aura_breakdown (
  user_id text primary key,
  creation_aura integer not null default 0,
  research_aura integer not null default 0,
  engineering_aura integer not null default 0,
  writing_aura integer not null default 0,
  innovation_aura integer not null default 0,
  community_aura integer not null default 0,
  hire_aura integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  badge_name text not null,
  badge_description text,
  awarded_at timestamptz not null default now(),
  unique (user_id, badge_name)
);

create index if not exists creations_public_created_idx
  on public.creations (is_public, created_at desc);

create index if not exists creations_user_created_idx
  on public.creations (user_id, created_at desc);

create index if not exists creations_aura_idx
  on public.creations (aura_score desc, created_at desc);

create index if not exists creation_reactions_creation_idx
  on public.creation_reactions (creation_id, reaction);

create index if not exists creation_ratings_creation_idx
  on public.creation_ratings (creation_id);

create index if not exists creation_comments_creation_idx
  on public.creation_comments (creation_id, created_at desc);

-- The prototype frontend uses a custom local lusers session with the anon key.
alter table public.creations disable row level security;
alter table public.creation_reactions disable row level security;
alter table public.creation_ratings disable row level security;
alter table public.creation_comments disable row level security;
alter table public.recruiter_bookmarks disable row level security;
alter table public.user_aura_breakdown disable row level security;
alter table public.user_badges disable row level security;

grant select, insert, update, delete on public.creations to anon, authenticated;
grant select, insert, update, delete on public.creation_reactions to anon, authenticated;
grant select, insert, update, delete on public.creation_ratings to anon, authenticated;
grant select, insert, update, delete on public.creation_comments to anon, authenticated;
grant select, insert, update, delete on public.recruiter_bookmarks to anon, authenticated;
grant select, insert, update, delete on public.user_aura_breakdown to anon, authenticated;
grant select, insert, update, delete on public.user_badges to anon, authenticated;

notify pgrst, 'reload schema';
