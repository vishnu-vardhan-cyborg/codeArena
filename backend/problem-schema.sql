create extension if not exists pgcrypto;

create table if not exists public.problems (
  id text primary key,
  title text not null,
  difficulty text not null check (difficulty in ('Easy', 'Medium', 'Hard', 'Extreme')),
  topics text[] not null default array[]::text[],
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

alter table public.problems
  drop constraint if exists problems_difficulty_check;

alter table public.problems
  add constraint problems_difficulty_check
  check (difficulty in ('Easy', 'Medium', 'Hard', 'Extreme'));

alter table public.problems
  add column if not exists topics text[] not null default array[]::text[];

create index if not exists problems_topics_idx
  on public.problems using gin (topics);

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

create table if not exists public.problem_notes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  problem_id text not null references public.problems(id) on delete cascade,
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, problem_id)
);

create table if not exists public.problem_editorials (
  problem_id text primary key references public.problems(id) on delete cascade,
  topics text[] not null default array[]::text[],
  overview text not null,
  approach text not null,
  solution_python text not null default '',
  solution_java text not null default '',
  complexity_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists problem_test_cases_problem_idx
  on public.problem_test_cases (problem_id, sort_order);

create index if not exists problem_submissions_problem_status_idx
  on public.problem_submissions (problem_id, status, created_at desc);

create index if not exists problem_submissions_user_idx
  on public.problem_submissions (user_id, created_at desc);

create index if not exists user_problem_progress_user_idx
  on public.user_problem_progress (user_id, solved_at);

create index if not exists problem_notes_user_problem_idx
  on public.problem_notes (user_id, problem_id);

alter table public.problems disable row level security;
alter table public.problem_submissions disable row level security;
alter table public.user_problem_progress disable row level security;
alter table public.problem_notes disable row level security;
alter table public.problem_editorials disable row level security;

grant select on public.problems to anon, authenticated;
grant select on public.problem_editorials to anon, authenticated;

-- Hidden tests must only be read by the backend using SUPABASE_SECRET_KEY
-- (recommended) or the legacy SUPABASE_SERVICE_ROLE_KEY.
alter table public.problem_test_cases enable row level security;
revoke insert, update, delete on public.problems from anon, authenticated;
revoke all on public.problem_submissions from anon, authenticated;
revoke all on public.user_problem_progress from anon, authenticated;
revoke all on public.problem_notes from anon, authenticated;
revoke insert, update, delete on public.problem_editorials from anon, authenticated;
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

update public.problems as problem
set topics = topic_seed.topics
from (
  values
    ('two-sum', array['Array', 'Hash Map']::text[]),
    ('valid-parentheses', array['String', 'Stack']::text[]),
    ('longest-substring', array['String', 'Sliding Window', 'Hash Set']::text[]),
    ('group-anagrams', array['String', 'Hash Map', 'Sorting']::text[]),
    ('merge-k-lists', array['Linked List', 'Heap', 'Divide and Conquer']::text[]),
    ('trapping-rain-water', array['Array', 'Two Pointers', 'Prefix']::text[])
) as topic_seed(id, topics)
where problem.id = topic_seed.id;

insert into public.problems (
  id, title, difficulty, topics, description, input_format, output_format,
  examples, constraints, starter_code, expected_time_complexity,
  expected_space_complexity, xp_reward
)
values
(
  'contains-duplicate',
  'Contains Duplicate',
  'Easy',
  array['Array', 'Hash Set']::text[],
  'Return true if any value appears at least twice in the array.',
  'Line 1: n. Line 2: n space-separated integers.',
  'Print true or false.',
  jsonb_build_array(jsonb_build_object('input', E'4\n1 2 3 1', 'output', 'true')),
  jsonb_build_array('1 <= n <= 100000', 'Values fit in signed 32-bit integers.'),
  jsonb_build_object('python', E'import sys\n\n\ndef solve(data: str) -> str:\n    return ""\n\n\nprint(solve(sys.stdin.read()))\n', 'java', E'import java.io.*;\n\npublic class Main {\n  static String solve(String input) {\n    return "";\n  }\n\n  public static void main(String[] args) throws Exception {\n    System.out.print(solve(new String(System.in.readAllBytes())));\n  }\n}\n'),
  'O(n)',
  'O(n)',
  20
),
(
  'best-time-stock',
  'Best Time to Buy and Sell Stock',
  'Easy',
  array['Array', 'Greedy']::text[],
  'Find the maximum profit from one buy and one sell in chronological price order.',
  'Line 1: n. Line 2: n space-separated prices.',
  'Print the maximum profit, or 0 if no profit is possible.',
  jsonb_build_array(jsonb_build_object('input', E'6\n7 1 5 3 6 4', 'output', '5')),
  jsonb_build_array('1 <= n <= 100000', '0 <= price <= 100000'),
  jsonb_build_object('python', E'import sys\n\n\ndef solve(data: str) -> str:\n    return ""\n\n\nprint(solve(sys.stdin.read()))\n', 'java', E'import java.io.*;\n\npublic class Main {\n  static String solve(String input) {\n    return "";\n  }\n\n  public static void main(String[] args) throws Exception {\n    System.out.print(solve(new String(System.in.readAllBytes())));\n  }\n}\n'),
  'O(n)',
  'O(1)',
  20
),
(
  'valid-palindrome',
  'Valid Palindrome',
  'Easy',
  array['String', 'Two Pointers']::text[],
  'Check whether a string is a palindrome after ignoring non-alphanumeric characters and case.',
  'One line containing the string.',
  'Print true or false.',
  jsonb_build_array(jsonb_build_object('input', 'A man, a plan, a canal: Panama', 'output', 'true')),
  jsonb_build_array('1 <= length <= 200000'),
  jsonb_build_object('python', E'import sys\n\n\ndef solve(data: str) -> str:\n    return ""\n\n\nprint(solve(sys.stdin.read()))\n', 'java', E'import java.io.*;\n\npublic class Main {\n  static String solve(String input) {\n    return "";\n  }\n\n  public static void main(String[] args) throws Exception {\n    System.out.print(solve(new String(System.in.readAllBytes())));\n  }\n}\n'),
  'O(n)',
  'O(1)',
  20
),
(
  'binary-search',
  'Binary Search',
  'Easy',
  array['Array', 'Binary Search']::text[],
  'Find the target in a sorted array and print its index, or -1 if absent.',
  'Line 1: n. Line 2: n sorted integers. Line 3: target.',
  'Print one integer index.',
  jsonb_build_array(jsonb_build_object('input', E'5\n1 3 5 7 9\n7', 'output', '3')),
  jsonb_build_array('1 <= n <= 100000', 'Array is sorted in ascending order.'),
  jsonb_build_object('python', E'import sys\n\n\ndef solve(data: str) -> str:\n    return ""\n\n\nprint(solve(sys.stdin.read()))\n', 'java', E'import java.io.*;\n\npublic class Main {\n  static String solve(String input) {\n    return "";\n  }\n\n  public static void main(String[] args) throws Exception {\n    System.out.print(solve(new String(System.in.readAllBytes())));\n  }\n}\n'),
  'O(log n)',
  'O(1)',
  20
),
(
  'fibonacci-mod',
  'Fibonacci Mod',
  'Easy',
  array['Math', 'Dynamic Programming']::text[],
  'Print the nth Fibonacci number modulo 1000000007, where F0 = 0 and F1 = 1.',
  'One integer n.',
  'Print one integer.',
  jsonb_build_array(jsonb_build_object('input', '10', 'output', '55')),
  jsonb_build_array('0 <= n <= 1000000'),
  jsonb_build_object('python', E'import sys\n\n\ndef solve(data: str) -> str:\n    return ""\n\n\nprint(solve(sys.stdin.read()))\n', 'java', E'import java.io.*;\n\npublic class Main {\n  static String solve(String input) {\n    return "";\n  }\n\n  public static void main(String[] args) throws Exception {\n    System.out.print(solve(new String(System.in.readAllBytes())));\n  }\n}\n'),
  'O(n)',
  'O(1)',
  20
),
(
  'product-except-self',
  'Product Except Self',
  'Medium',
  array['Array', 'Prefix', 'Suffix']::text[],
  'For each index, print the product of all other values without using division.',
  'Line 1: n. Line 2: n space-separated integers.',
  'Print n space-separated integers.',
  jsonb_build_array(jsonb_build_object('input', E'4\n1 2 3 4', 'output', '24 12 8 6')),
  jsonb_build_array('2 <= n <= 100000', 'Products fit in signed 64-bit integers.'),
  jsonb_build_object('python', E'import sys\n\n\ndef solve(data: str) -> str:\n    return ""\n\n\nprint(solve(sys.stdin.read()))\n', 'java', E'import java.io.*;\n\npublic class Main {\n  static String solve(String input) {\n    return "";\n  }\n\n  public static void main(String[] args) throws Exception {\n    System.out.print(solve(new String(System.in.readAllBytes())));\n  }\n}\n'),
  'O(n)',
  'O(1) extra',
  50
),
(
  'top-k-frequent',
  'Top K Frequent Elements',
  'Medium',
  array['Hash Map', 'Heap', 'Sorting']::text[],
  'Print the k most frequent numbers. Break frequency ties by smaller numeric value.',
  'Line 1: n k. Line 2: n space-separated integers.',
  'Print k integers ordered by frequency descending, then value ascending.',
  jsonb_build_array(jsonb_build_object('input', E'6 2\n1 1 1 2 2 3', 'output', '1 2')),
  jsonb_build_array('1 <= k <= n <= 100000'),
  jsonb_build_object('python', E'import sys\n\n\ndef solve(data: str) -> str:\n    return ""\n\n\nprint(solve(sys.stdin.read()))\n', 'java', E'import java.io.*;\n\npublic class Main {\n  static String solve(String input) {\n    return "";\n  }\n\n  public static void main(String[] args) throws Exception {\n    System.out.print(solve(new String(System.in.readAllBytes())));\n  }\n}\n'),
  'O(n log n)',
  'O(n)',
  50
),
(
  'coin-change',
  'Coin Change',
  'Medium',
  array['Dynamic Programming', 'BFS']::text[],
  'Find the minimum number of coins needed to make the target amount, or -1.',
  'Line 1: m amount. Line 2: m coin values.',
  'Print one integer.',
  jsonb_build_array(jsonb_build_object('input', E'3 11\n1 2 5', 'output', '3')),
  jsonb_build_array('1 <= m <= 50', '0 <= amount <= 100000'),
  jsonb_build_object('python', E'import sys\n\n\ndef solve(data: str) -> str:\n    return ""\n\n\nprint(solve(sys.stdin.read()))\n', 'java', E'import java.io.*;\n\npublic class Main {\n  static String solve(String input) {\n    return "";\n  }\n\n  public static void main(String[] args) throws Exception {\n    System.out.print(solve(new String(System.in.readAllBytes())));\n  }\n}\n'),
  'O(amount * m)',
  'O(amount)',
  50
),
(
  'number-of-islands',
  'Number of Islands',
  'Medium',
  array['Graph', 'DFS', 'BFS', 'Matrix']::text[],
  'Count connected groups of 1 cells in a binary grid using 4-direction movement.',
  'Line 1: rows columns. Next rows lines: grid characters 0 or 1.',
  'Print one integer.',
  jsonb_build_array(jsonb_build_object('input', E'4 5\n11110\n11010\n11000\n00000', 'output', '1')),
  jsonb_build_array('1 <= rows, columns <= 500'),
  jsonb_build_object('python', E'import sys\n\n\ndef solve(data: str) -> str:\n    return ""\n\n\nprint(solve(sys.stdin.read()))\n', 'java', E'import java.io.*;\n\npublic class Main {\n  static String solve(String input) {\n    return "";\n  }\n\n  public static void main(String[] args) throws Exception {\n    System.out.print(solve(new String(System.in.readAllBytes())));\n  }\n}\n'),
  'O(r * c)',
  'O(r * c)',
  50
),
(
  'rotate-matrix',
  'Rotate Matrix',
  'Medium',
  array['Matrix', 'Simulation']::text[],
  'Rotate an n by n matrix 90 degrees clockwise and print the result.',
  'Line 1: n. Next n lines: n integers each.',
  'Print n rows of the rotated matrix.',
  jsonb_build_array(jsonb_build_object('input', E'3\n1 2 3\n4 5 6\n7 8 9', 'output', E'7 4 1\n8 5 2\n9 6 3')),
  jsonb_build_array('1 <= n <= 300'),
  jsonb_build_object('python', E'import sys\n\n\ndef solve(data: str) -> str:\n    return ""\n\n\nprint(solve(sys.stdin.read()))\n', 'java', E'import java.io.*;\n\npublic class Main {\n  static String solve(String input) {\n    return "";\n  }\n\n  public static void main(String[] args) throws Exception {\n    System.out.print(solve(new String(System.in.readAllBytes())));\n  }\n}\n'),
  'O(n^2)',
  'O(n^2)',
  50
),
(
  'course-schedule',
  'Course Schedule',
  'Medium',
  array['Graph', 'Topological Sort']::text[],
  'Determine if all courses can be completed from prerequisite pairs.',
  'Line 1: n m. Next m lines: course prerequisite.',
  'Print true or false.',
  jsonb_build_array(jsonb_build_object('input', E'2 1\n1 0', 'output', 'true')),
  jsonb_build_array('1 <= n <= 100000', '0 <= m <= 200000'),
  jsonb_build_object('python', E'import sys\n\n\ndef solve(data: str) -> str:\n    return ""\n\n\nprint(solve(sys.stdin.read()))\n', 'java', E'import java.io.*;\n\npublic class Main {\n  static String solve(String input) {\n    return "";\n  }\n\n  public static void main(String[] args) throws Exception {\n    System.out.print(solve(new String(System.in.readAllBytes())));\n  }\n}\n'),
  'O(n + m)',
  'O(n + m)',
  50
),
(
  'decode-ways',
  'Decode Ways',
  'Medium',
  array['String', 'Dynamic Programming']::text[],
  'Count how many ways the digit string can be decoded where 1 maps to A and 26 maps to Z.',
  'One line containing digits.',
  'Print one integer.',
  jsonb_build_array(jsonb_build_object('input', '226', 'output', '3')),
  jsonb_build_array('1 <= length <= 100000'),
  jsonb_build_object('python', E'import sys\n\n\ndef solve(data: str) -> str:\n    return ""\n\n\nprint(solve(sys.stdin.read()))\n', 'java', E'import java.io.*;\n\npublic class Main {\n  static String solve(String input) {\n    return "";\n  }\n\n  public static void main(String[] args) throws Exception {\n    System.out.print(solve(new String(System.in.readAllBytes())));\n  }\n}\n'),
  'O(n)',
  'O(1)',
  50
),
(
  'minimum-window-substring',
  'Minimum Window Substring',
  'Hard',
  array['String', 'Sliding Window', 'Hash Map']::text[],
  'Find the shortest substring of s that contains every character of t with multiplicity.',
  'Line 1: s. Line 2: t.',
  'Print the substring, or an empty line if none exists.',
  jsonb_build_array(jsonb_build_object('input', E'ADOBECODEBANC\nABC', 'output', 'BANC')),
  jsonb_build_array('1 <= length of s, t <= 100000'),
  jsonb_build_object('python', E'import sys\n\n\ndef solve(data: str) -> str:\n    return ""\n\n\nprint(solve(sys.stdin.read()))\n', 'java', E'import java.io.*;\n\npublic class Main {\n  static String solve(String input) {\n    return "";\n  }\n\n  public static void main(String[] args) throws Exception {\n    System.out.print(solve(new String(System.in.readAllBytes())));\n  }\n}\n'),
  'O(n)',
  'O(k)',
  100
),
(
  'word-ladder',
  'Word Ladder',
  'Hard',
  array['Graph', 'BFS', 'String']::text[],
  'Return the length of the shortest transformation from begin word to end word by changing one letter at a time.',
  'Line 1: begin word. Line 2: end word. Line 3: n. Next n lines: dictionary words.',
  'Print one integer, or 0 if no path exists.',
  jsonb_build_array(jsonb_build_object('input', E'hit\ncog\n6\nhot\ndot\ndog\nlot\nlog\ncog', 'output', '5')),
  jsonb_build_array('1 <= word length <= 20', '1 <= n <= 10000'),
  jsonb_build_object('python', E'import sys\n\n\ndef solve(data: str) -> str:\n    return ""\n\n\nprint(solve(sys.stdin.read()))\n', 'java', E'import java.io.*;\n\npublic class Main {\n  static String solve(String input) {\n    return "";\n  }\n\n  public static void main(String[] args) throws Exception {\n    System.out.print(solve(new String(System.in.readAllBytes())));\n  }\n}\n'),
  'O(n * wordLength^2)',
  'O(n * wordLength)',
  100
),
(
  'largest-rectangle-histogram',
  'Largest Rectangle in Histogram',
  'Hard',
  array['Array', 'Stack']::text[],
  'Find the largest rectangle area that can be formed in the histogram.',
  'Line 1: n. Line 2: n heights.',
  'Print one integer.',
  jsonb_build_array(jsonb_build_object('input', E'6\n2 1 5 6 2 3', 'output', '10')),
  jsonb_build_array('1 <= n <= 100000'),
  jsonb_build_object('python', E'import sys\n\n\ndef solve(data: str) -> str:\n    return ""\n\n\nprint(solve(sys.stdin.read()))\n', 'java', E'import java.io.*;\n\npublic class Main {\n  static String solve(String input) {\n    return "";\n  }\n\n  public static void main(String[] args) throws Exception {\n    System.out.print(solve(new String(System.in.readAllBytes())));\n  }\n}\n'),
  'O(n)',
  'O(n)',
  100
),
(
  'edit-distance',
  'Edit Distance',
  'Hard',
  array['String', 'Dynamic Programming']::text[],
  'Compute the minimum insertions, deletions, and replacements needed to transform word1 into word2.',
  'Line 1: word1. Line 2: word2.',
  'Print one integer.',
  jsonb_build_array(jsonb_build_object('input', E'horse\nros', 'output', '3')),
  jsonb_build_array('0 <= length <= 1000'),
  jsonb_build_object('python', E'import sys\n\n\ndef solve(data: str) -> str:\n    return ""\n\n\nprint(solve(sys.stdin.read()))\n', 'java', E'import java.io.*;\n\npublic class Main {\n  static String solve(String input) {\n    return "";\n  }\n\n  public static void main(String[] args) throws Exception {\n    System.out.print(solve(new String(System.in.readAllBytes())));\n  }\n}\n'),
  'O(n * m)',
  'O(min(n, m))',
  100
),
(
  'median-two-sorted-arrays',
  'Median of Two Sorted Arrays',
  'Hard',
  array['Array', 'Binary Search']::text[],
  'Find the median value after merging two sorted arrays conceptually.',
  'Line 1: n m. Line 2: n sorted integers. Line 3: m sorted integers.',
  'Print the median. Use .5 when needed.',
  jsonb_build_array(jsonb_build_object('input', E'2 1\n1 3\n2', 'output', '2')),
  jsonb_build_array('0 <= n, m <= 100000', 'n + m >= 1'),
  jsonb_build_object('python', E'import sys\n\n\ndef solve(data: str) -> str:\n    return ""\n\n\nprint(solve(sys.stdin.read()))\n', 'java', E'import java.io.*;\n\npublic class Main {\n  static String solve(String input) {\n    return "";\n  }\n\n  public static void main(String[] args) throws Exception {\n    System.out.print(solve(new String(System.in.readAllBytes())));\n  }\n}\n'),
  'O(log(min(n, m)))',
  'O(1)',
  100
),
(
  'regular-expression-matching',
  'Regular Expression Matching',
  'Extreme',
  array['String', 'Dynamic Programming']::text[],
  'Implement matching for pattern characters . and * where * means zero or more of the previous token.',
  'Line 1: s. Line 2: pattern.',
  'Print true or false.',
  jsonb_build_array(jsonb_build_object('input', E'aa\na*', 'output', 'true')),
  jsonb_build_array('0 <= length of s, pattern <= 2000'),
  jsonb_build_object('python', E'import sys\n\n\ndef solve(data: str) -> str:\n    return ""\n\n\nprint(solve(sys.stdin.read()))\n', 'java', E'import java.io.*;\n\npublic class Main {\n  static String solve(String input) {\n    return "";\n  }\n\n  public static void main(String[] args) throws Exception {\n    System.out.print(solve(new String(System.in.readAllBytes())));\n  }\n}\n'),
  'O(n * m)',
  'O(n * m)',
  150
),
(
  'n-queens-count',
  'N Queens Count',
  'Extreme',
  array['Backtracking', 'Bitmask']::text[],
  'Count how many valid ways n queens can be placed on an n by n board.',
  'One integer n.',
  'Print one integer.',
  jsonb_build_array(jsonb_build_object('input', '4', 'output', '2')),
  jsonb_build_array('1 <= n <= 14'),
  jsonb_build_object('python', E'import sys\n\n\ndef solve(data: str) -> str:\n    return ""\n\n\nprint(solve(sys.stdin.read()))\n', 'java', E'import java.io.*;\n\npublic class Main {\n  static String solve(String input) {\n    return "";\n  }\n\n  public static void main(String[] args) throws Exception {\n    System.out.print(solve(new String(System.in.readAllBytes())));\n  }\n}\n'),
  'O(n!)',
  'O(n)',
  150
),
(
  'shortest-path-obstacles',
  'Shortest Path With Obstacles',
  'Extreme',
  array['Graph', 'BFS', 'Matrix']::text[],
  'Find the shortest path from top-left to bottom-right while eliminating at most k obstacle cells.',
  'Line 1: rows columns k. Next rows lines: grid characters 0 or 1.',
  'Print the minimum number of steps, or -1.',
  jsonb_build_array(jsonb_build_object('input', E'5 3 1\n000\n110\n000\n011\n000', 'output', '6')),
  jsonb_build_array('1 <= rows, columns <= 80', '0 <= k <= rows * columns'),
  jsonb_build_object('python', E'import sys\n\n\ndef solve(data: str) -> str:\n    return ""\n\n\nprint(solve(sys.stdin.read()))\n', 'java', E'import java.io.*;\n\npublic class Main {\n  static String solve(String input) {\n    return "";\n  }\n\n  public static void main(String[] args) throws Exception {\n    System.out.print(solve(new String(System.in.readAllBytes())));\n  }\n}\n'),
  'O(rows * columns * k)',
  'O(rows * columns * k)',
  150
)
on conflict (id) do update set
  title = excluded.title,
  difficulty = excluded.difficulty,
  topics = excluded.topics,
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
  'contains-duplicate',
  'best-time-stock',
  'valid-palindrome',
  'binary-search',
  'fibonacci-mod',
  'product-except-self',
  'top-k-frequent',
  'coin-change',
  'number-of-islands',
  'rotate-matrix',
  'course-schedule',
  'decode-ways',
  'minimum-window-substring',
  'word-ladder',
  'largest-rectangle-histogram',
  'edit-distance',
  'median-two-sorted-arrays',
  'regular-expression-matching',
  'n-queens-count',
  'shortest-path-obstacles'
);

insert into public.problem_test_cases
  (problem_id, stdin, expected_output, checker_type, is_hidden, sort_order)
values
  ('contains-duplicate', E'4\n1 2 3 1', 'true', 'tokens', false, 1),
  ('contains-duplicate', E'5\n1 2 3 4 5', 'false', 'tokens', true, 2),
  ('best-time-stock', E'6\n7 1 5 3 6 4', '5', 'tokens', false, 1),
  ('best-time-stock', E'5\n7 6 4 3 1', '0', 'tokens', true, 2),
  ('valid-palindrome', 'A man, a plan, a canal: Panama', 'true', 'tokens', false, 1),
  ('valid-palindrome', 'race a car', 'false', 'tokens', true, 2),
  ('binary-search', E'5\n1 3 5 7 9\n7', '3', 'tokens', false, 1),
  ('binary-search', E'5\n1 3 5 7 9\n2', '-1', 'tokens', true, 2),
  ('fibonacci-mod', '10', '55', 'tokens', false, 1),
  ('fibonacci-mod', '50', '586268941', 'tokens', true, 2),
  ('product-except-self', E'4\n1 2 3 4', '24 12 8 6', 'tokens', false, 1),
  ('product-except-self', E'4\n-1 1 0 -3', '0 0 3 0', 'tokens', true, 2),
  ('top-k-frequent', E'6 2\n1 1 1 2 2 3', '1 2', 'tokens', false, 1),
  ('top-k-frequent', E'6 2\n4 4 1 1 2 2', '1 2', 'tokens', true, 2),
  ('coin-change', E'3 11\n1 2 5', '3', 'tokens', false, 1),
  ('coin-change', E'1 3\n2', '-1', 'tokens', true, 2),
  ('number-of-islands', E'4 5\n11110\n11010\n11000\n00000', '1', 'tokens', false, 1),
  ('number-of-islands', E'4 5\n11000\n11000\n00100\n00011', '3', 'tokens', true, 2),
  ('rotate-matrix', E'3\n1 2 3\n4 5 6\n7 8 9', E'7 4 1\n8 5 2\n9 6 3', 'tokens', false, 1),
  ('rotate-matrix', E'2\n1 2\n3 4', E'3 1\n4 2', 'tokens', true, 2),
  ('course-schedule', E'2 1\n1 0', 'true', 'tokens', false, 1),
  ('course-schedule', E'2 2\n1 0\n0 1', 'false', 'tokens', true, 2),
  ('decode-ways', '226', '3', 'tokens', false, 1),
  ('decode-ways', '06', '0', 'tokens', true, 2),
  ('minimum-window-substring', E'ADOBECODEBANC\nABC', 'BANC', 'tokens', false, 1),
  ('minimum-window-substring', E'a\naa', '', 'exact', true, 2),
  ('word-ladder', E'hit\ncog\n6\nhot\ndot\ndog\nlot\nlog\ncog', '5', 'tokens', false, 1),
  ('word-ladder', E'hit\ncog\n3\nhot\ndot\ndog', '0', 'tokens', true, 2),
  ('largest-rectangle-histogram', E'6\n2 1 5 6 2 3', '10', 'tokens', false, 1),
  ('largest-rectangle-histogram', E'2\n2 4', '4', 'tokens', true, 2),
  ('edit-distance', E'horse\nros', '3', 'tokens', false, 1),
  ('edit-distance', E'intention\nexecution', '5', 'tokens', true, 2),
  ('median-two-sorted-arrays', E'2 1\n1 3\n2', '2', 'tokens', false, 1),
  ('median-two-sorted-arrays', E'2 2\n1 2\n3 4', '2.5', 'tokens', true, 2),
  ('regular-expression-matching', E'aa\na*', 'true', 'tokens', false, 1),
  ('regular-expression-matching', E'mississippi\nmis*is*p*.', 'false', 'tokens', true, 2),
  ('n-queens-count', '4', '2', 'tokens', false, 1),
  ('n-queens-count', '5', '10', 'tokens', true, 2),
  ('shortest-path-obstacles', E'5 3 1\n000\n110\n000\n011\n000', '6', 'tokens', false, 1),
  ('shortest-path-obstacles', E'3 3 1\n010\n111\n000', '-1', 'tokens', true, 2);

insert into public.problem_editorials (
  problem_id, topics, overview, approach, solution_python, solution_java,
  complexity_notes
)
select
  problem.id,
  problem.topics,
  'This editorial summarizes the core pattern for ' || problem.title || '. Focus on the listed topics and the exact input-output contract before coding.',
  'Identify the data structure implied by the topic tags, process the input once when possible, and verify boundary cases from the examples and hidden tests.',
  'Python demo: parse stdin inside solve(data), apply the topic pattern, and return the exact output string. Replace this seed note with a full reference solution when the problem is finalized.',
  'Java demo: parse stdin inside solve(input), apply the topic pattern, and return the exact output string. Replace this seed note with a full reference solution when the problem is finalized.',
  'Expected time: ' || problem.expected_time_complexity || '. Expected space: ' || problem.expected_space_complexity || '.'
from public.problems as problem
where problem.id in (
  'two-sum',
  'valid-parentheses',
  'longest-substring',
  'group-anagrams',
  'merge-k-lists',
  'trapping-rain-water',
  'contains-duplicate',
  'best-time-stock',
  'valid-palindrome',
  'binary-search',
  'fibonacci-mod',
  'product-except-self',
  'top-k-frequent',
  'coin-change',
  'number-of-islands',
  'rotate-matrix',
  'course-schedule',
  'decode-ways',
  'minimum-window-substring',
  'word-ladder',
  'largest-rectangle-histogram',
  'edit-distance',
  'median-two-sorted-arrays',
  'regular-expression-matching',
  'n-queens-count',
  'shortest-path-obstacles'
)
on conflict (problem_id) do update set
  topics = excluded.topics,
  overview = excluded.overview,
  approach = excluded.approach,
  solution_python = excluded.solution_python,
  solution_java = excluded.solution_java,
  complexity_notes = excluded.complexity_notes,
  updated_at = now();

notify pgrst, 'reload schema';
