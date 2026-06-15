create extension if not exists pgcrypto;

create table if not exists public.problems (
  id text primary key,
  title text not null,
  difficulty text not null check (difficulty in ('Easy', 'Medium', 'Hard')),
  description text not null,
  input_format text not null,
  output_format text not null,
  examples jsonb not null default '[]'::jsonb,
  constraints jsonb not null default '[]'::jsonb,
  starter_code jsonb not null default '{}'::jsonb,
  expected_time_complexity text not null,
  expected_space_complexity text not null,
  xp_reward integer not null check (xp_reward > 0),
  submission_count integer not null default 0,
  accepted_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.problem_test_cases (
  id uuid primary key default gen_random_uuid(),
  problem_id text not null references public.problems(id) on delete cascade,
  stdin text not null,
  expected_output text not null,
  checker_type text not null default 'tokens'
    check (checker_type in ('exact', 'tokens', 'unordered_lines')),
  is_hidden boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.problem_submissions (
  id uuid primary key default gen_random_uuid(),
  problem_id text not null references public.problems(id) on delete cascade,
  user_id text not null,
  language text not null,
  source_code text not null,
  status text not null
    check (status in (
      'Accepted',
      'Wrong Answer',
      'Runtime Error',
      'Time Limit Exceeded',
      'Compilation Error',
      'Internal Error'
    )),
  passed_tests integer not null default 0,
  total_tests integer not null default 0,
  runtime_ms numeric,
  estimated_time_complexity text,
  estimated_space_complexity text,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_problem_progress (
  user_id text not null,
  problem_id text not null references public.problems(id) on delete cascade,
  attempts integer not null default 0,
  solved_at timestamptz,
  best_runtime_ms numeric,
  xp_awarded integer not null default 0,
  last_submission_id uuid references public.problem_submissions(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (user_id, problem_id)
);

create index if not exists problem_test_cases_problem_idx
  on public.problem_test_cases (problem_id, sort_order);

create index if not exists problem_submissions_problem_status_idx
  on public.problem_submissions (problem_id, status, created_at desc);

create index if not exists problem_submissions_user_idx
  on public.problem_submissions (user_id, created_at desc);

create index if not exists user_problem_progress_user_idx
  on public.user_problem_progress (user_id, solved_at);

alter table public.problems disable row level security;
alter table public.problem_submissions disable row level security;
alter table public.user_problem_progress disable row level security;

grant select on public.problems to anon, authenticated;

-- Hidden tests must only be read by the backend using SUPABASE_SECRET_KEY
-- (recommended) or the legacy SUPABASE_SERVICE_ROLE_KEY.
alter table public.problem_test_cases enable row level security;
revoke insert, update, delete on public.problems from anon, authenticated;
revoke all on public.problem_submissions from anon, authenticated;
revoke all on public.user_problem_progress from anon, authenticated;
revoke all on public.problem_test_cases from anon, authenticated;

create or replace function public.update_problem_metrics_after_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reward integer := 0;
  was_solved boolean := false;
begin
  select exists (
    select 1
    from public.user_problem_progress
    where user_id = new.user_id
      and problem_id = new.problem_id
      and solved_at is not null
  ) into was_solved;

  update public.problems
  set
    submission_count = submission_count + 1,
    accepted_count = accepted_count + case when new.status = 'Accepted' then 1 else 0 end,
    updated_at = now()
  where id = new.problem_id;

  if new.status = 'Accepted' and not was_solved then
    select xp_reward into reward
    from public.problems
    where id = new.problem_id;
  end if;

  insert into public.user_problem_progress (
    user_id,
    problem_id,
    attempts,
    solved_at,
    best_runtime_ms,
    xp_awarded,
    last_submission_id,
    updated_at
  )
  values (
    new.user_id,
    new.problem_id,
    1,
    case when new.status = 'Accepted' then now() else null end,
    case when new.status = 'Accepted' then new.runtime_ms else null end,
    reward,
    new.id,
    now()
  )
  on conflict (user_id, problem_id) do update
  set
    attempts = public.user_problem_progress.attempts + 1,
    solved_at = coalesce(
      public.user_problem_progress.solved_at,
      case when new.status = 'Accepted' then now() else null end
    ),
    best_runtime_ms = case
      when new.status <> 'Accepted' then public.user_problem_progress.best_runtime_ms
      when public.user_problem_progress.best_runtime_ms is null then new.runtime_ms
      else least(public.user_problem_progress.best_runtime_ms, new.runtime_ms)
    end,
    xp_awarded = public.user_problem_progress.xp_awarded + reward,
    last_submission_id = new.id,
    updated_at = now();

  if reward > 0 then
    update public.lusers
    set xp = coalesce(xp, 0) + reward
    where id::text = new.user_id;
  end if;

  if new.status = 'Accepted' then
    insert into public.user_activity (
      user_id,
      activity_type,
      problem_id,
      activity_date,
      metadata
    )
    values (
      new.user_id,
      'problem_submission',
      new.problem_id,
      current_date,
      jsonb_build_object(
        'languageName', new.language,
        'status', new.status,
        'runtimeMs', new.runtime_ms,
        'submissionId', new.id
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists problem_submission_metrics_trigger
  on public.problem_submissions;
create trigger problem_submission_metrics_trigger
after insert on public.problem_submissions
for each row execute function public.update_problem_metrics_after_submission();

insert into public.problems (
  id, title, difficulty, description, input_format, output_format,
  examples, constraints, starter_code, expected_time_complexity,
  expected_space_complexity, xp_reward
)
values
(
  'two-sum',
  'Two Sum',
  'Easy',
  'Find the two distinct zero-based indices whose values add up to the target. Exactly one valid pair exists.',
  'Line 1: n. Line 2: n space-separated integers. Line 3: target.',
  'Print the two indices in ascending order, separated by one space.',
  jsonb_build_array(jsonb_build_object('input', E'4\n2 7 11 15\n9', 'output', '0 1')),
  jsonb_build_array('2 <= n <= 100000', 'Exactly one valid pair exists.'),
  jsonb_build_object(
    'python', E'import sys\n\n\ndef solve(data: str) -> str:\n    # Return the two indices separated by a space.\n    return ""\n\n\nprint(solve(sys.stdin.read()))\n',
    'java', E'import java.io.*;\n\npublic class Main {\n  static String solve(String input) {\n    // Return the two indices separated by a space.\n    return "";\n  }\n\n  public static void main(String[] args) throws Exception {\n    System.out.print(solve(new String(System.in.readAllBytes())));\n  }\n}\n'
  ),
  'O(n)',
  'O(n)',
  20
),
(
  'valid-parentheses',
  'Valid Parentheses',
  'Easy',
  'Determine whether every opening bracket is closed by the matching bracket in the correct order.',
  'One line containing only (), [], and {} characters.',
  'Print true or false.',
  jsonb_build_array(jsonb_build_object('input', '()[]{}', 'output', 'true')),
  jsonb_build_array('1 <= length <= 100000', 'The input contains only bracket characters.'),
  jsonb_build_object(
    'python', E'import sys\n\n\ndef solve(data: str) -> str:\n    return "false"\n\n\nprint(solve(sys.stdin.read().strip()))\n',
    'java', E'import java.io.*;\n\npublic class Main {\n  static String solve(String input) {\n    return "false";\n  }\n\n  public static void main(String[] args) throws Exception {\n    System.out.print(solve(new String(System.in.readAllBytes()).trim()));\n  }\n}\n'
  ),
  'O(n)',
  'O(n)',
  20
),
(
  'longest-substring',
  'Longest Substring Without Repeating Characters',
  'Medium',
  'Return the length of the longest contiguous substring containing no repeated characters.',
  'One line containing the string.',
  'Print one integer.',
  jsonb_build_array(jsonb_build_object('input', 'abcabcbb', 'output', '3')),
  jsonb_build_array('1 <= length <= 50000', 'The string may contain letters, digits, symbols, and spaces.'),
  jsonb_build_object(
    'python', E'import sys\n\n\ndef solve(text: str) -> int:\n    return 0\n\n\nprint(solve(sys.stdin.read().rstrip("\\n")))\n',
    'java', E'import java.io.*;\n\npublic class Main {\n  static int solve(String input) {\n    return 0;\n  }\n\n  public static void main(String[] args) throws Exception {\n    System.out.print(solve(new String(System.in.readAllBytes()).stripTrailing()));\n  }\n}\n'
  ),
  'O(n)',
  'O(k)',
  50
),
(
  'group-anagrams',
  'Group Anagrams',
  'Medium',
  'Group words that contain the same letters. Sort words inside each group, then print the groups in lexicographic order by their full line.',
  'Line 1: n. The next n lines each contain one lowercase word.',
  'Print one group per line. Words in a group must be sorted and separated by one space. Sort all output lines lexicographically.',
  jsonb_build_array(jsonb_build_object('input', E'6\neat\ntea\ntan\nate\nnat\nbat', 'output', E'ate eat tea\nbat\nnat tan')),
  jsonb_build_array('1 <= n <= 10000', 'Words contain lowercase English letters.'),
  jsonb_build_object(
    'python', E'import sys\n\n\ndef solve(data: str) -> str:\n    return ""\n\n\nprint(solve(sys.stdin.read()))\n',
    'java', E'import java.io.*;\n\npublic class Main {\n  static String solve(String input) {\n    return "";\n  }\n\n  public static void main(String[] args) throws Exception {\n    System.out.print(solve(new String(System.in.readAllBytes())));\n  }\n}\n'
  ),
  'O(n * k log k)',
  'O(n * k)',
  50
),
(
  'merge-k-lists',
  'Merge K Sorted Lists',
  'Hard',
  'Merge k sorted integer lists into one sorted sequence.',
  'Line 1: k. Each of the next k lines starts with its list length followed by the sorted values.',
  'Print all merged values separated by one space.',
  jsonb_build_array(jsonb_build_object('input', E'3\n3 1 4 5\n3 1 3 4\n2 2 6', 'output', '1 1 2 3 4 4 5 6')),
  jsonb_build_array('0 <= total values <= 100000', 'Every input list is sorted.'),
  jsonb_build_object(
    'python', E'import sys\n\n\ndef solve(data: str) -> str:\n    return ""\n\n\nprint(solve(sys.stdin.read()))\n',
    'java', E'import java.io.*;\n\npublic class Main {\n  static String solve(String input) {\n    return "";\n  }\n\n  public static void main(String[] args) throws Exception {\n    System.out.print(solve(new String(System.in.readAllBytes())));\n  }\n}\n'
  ),
  'O(n log k)',
  'O(k)',
  100
),
(
  'trapping-rain-water',
  'Trapping Rain Water',
  'Hard',
  'Given non-negative elevation heights, calculate the total units of rain water trapped between the bars.',
  'Line 1: n. Line 2: n space-separated heights.',
  'Print one integer.',
  jsonb_build_array(jsonb_build_object('input', E'12\n0 1 0 2 1 0 1 3 2 1 2 1', 'output', '6')),
  jsonb_build_array('1 <= n <= 100000', '0 <= height <= 100000'),
  jsonb_build_object(
    'python', E'import sys\n\n\ndef solve(data: str) -> int:\n    return 0\n\n\nprint(solve(sys.stdin.read()))\n',
    'java', E'import java.io.*;\n\npublic class Main {\n  static int solve(String input) {\n    return 0;\n  }\n\n  public static void main(String[] args) throws Exception {\n    System.out.print(solve(new String(System.in.readAllBytes())));\n  }\n}\n'
  ),
  'O(n)',
  'O(1)',
  100
)
on conflict (id) do update set
  title = excluded.title,
  difficulty = excluded.difficulty,
  description = excluded.description,
  input_format = excluded.input_format,
  output_format = excluded.output_format,
  examples = excluded.examples,
  constraints = excluded.constraints,
  starter_code = excluded.starter_code,
  expected_time_complexity = excluded.expected_time_complexity,
  expected_space_complexity = excluded.expected_space_complexity,
  xp_reward = excluded.xp_reward,
  updated_at = now();

delete from public.problem_test_cases
where problem_id in (
  'two-sum',
  'valid-parentheses',
  'longest-substring',
  'group-anagrams',
  'merge-k-lists',
  'trapping-rain-water'
);

insert into public.problem_test_cases
  (problem_id, stdin, expected_output, checker_type, is_hidden, sort_order)
values
  ('two-sum', E'4\n2 7 11 15\n9', '0 1', 'tokens', false, 1),
  ('two-sum', E'3\n3 2 4\n6', '1 2', 'tokens', true, 2),
  ('two-sum', E'2\n3 3\n6', '0 1', 'tokens', true, 3),
  ('two-sum', E'5\n-1 -2 -3 -4 -5\n-8', '2 4', 'tokens', true, 4),
  ('two-sum', E'5\n10 20 30 40 55\n75', '1 4', 'tokens', true, 5),
  ('valid-parentheses', '()[]{}', 'true', 'tokens', false, 1),
  ('valid-parentheses', '([{}])', 'true', 'tokens', true, 2),
  ('valid-parentheses', '(]', 'false', 'tokens', true, 3),
  ('valid-parentheses', '([)]', 'false', 'tokens', true, 4),
  ('valid-parentheses', '{{[[(())]]}}', 'true', 'tokens', true, 5),
  ('valid-parentheses', '(((((', 'false', 'tokens', true, 6),
  ('longest-substring', 'abcabcbb', '3', 'tokens', false, 1),
  ('longest-substring', 'bbbbb', '1', 'tokens', true, 2),
  ('longest-substring', 'pwwkew', '3', 'tokens', true, 3),
  ('longest-substring', 'dvdf', '3', 'tokens', true, 4),
  ('longest-substring', 'anviaj', '5', 'tokens', true, 5),
  ('longest-substring', 'a b c a', '3', 'tokens', true, 6),
  ('group-anagrams', E'6\neat\ntea\ntan\nate\nnat\nbat', E'ate eat tea\nbat\nnat tan', 'unordered_lines', false, 1),
  ('group-anagrams', E'4\nabc\nbca\ncab\nxyz', E'abc bca cab\nxyz', 'unordered_lines', true, 2),
  ('group-anagrams', E'5\na\na\nb\nab\nba', E'a a\nab ba\nb', 'unordered_lines', true, 3),
  ('group-anagrams', E'3\nlisten\nsilent\nenlist', 'enlist listen silent', 'unordered_lines', true, 4),
  ('merge-k-lists', E'3\n3 1 4 5\n3 1 3 4\n2 2 6', '1 1 2 3 4 4 5 6', 'tokens', false, 1),
  ('merge-k-lists', E'3\n0\n1 1\n0', '1', 'tokens', true, 2),
  ('merge-k-lists', E'2\n4 -5 -2 0 9\n3 -4 1 8', '-5 -4 -2 0 1 8 9', 'tokens', true, 3),
  ('merge-k-lists', E'1\n5 1 2 3 4 5', '1 2 3 4 5', 'tokens', true, 4),
  ('trapping-rain-water', E'12\n0 1 0 2 1 0 1 3 2 1 2 1', '6', 'tokens', false, 1),
  ('trapping-rain-water', E'6\n4 2 0 3 2 5', '9', 'tokens', true, 2),
  ('trapping-rain-water', E'3\n1 2 3', '0', 'tokens', true, 3),
  ('trapping-rain-water', E'5\n5 0 0 0 5', '15', 'tokens', true, 4),
  ('trapping-rain-water', E'7\n3 0 2 0 4 0 1', '7', 'tokens', true, 5);

notify pgrst, 'reload schema';
