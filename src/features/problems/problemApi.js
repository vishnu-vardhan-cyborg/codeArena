import { supabase } from "../../supabase";

const API_URL =
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_SOCKET_URL ||
  "http://localhost:4000";

const request = async (path, options = {}) => {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
};

export const loadProblems = async (userId) => {
  try {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    const data = await request(`/api/problems${query}`);
    if (data.problems?.length) return data.problems;
  } catch {
    // The public catalog can safely fall back to Supabase. Hidden tests cannot.
  }

  return loadProblemsFromSupabase(userId);
};

export const loadProblem = async (problemId, userId) => {
  try {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    const data = await request(
      `/api/problems/${encodeURIComponent(problemId)}${query}`
    );
    if (data.problem) return data.problem;
  } catch {
    // The public problem statement can safely fall back to Supabase.
  }

  const problems = await loadProblemsFromSupabase(userId, problemId);
  if (!problems[0]) throw new Error("Problem not found.");
  return problems[0];
};

export const loadTyphonLanguages = async () => {
  const data = await request("/api/typhon/languages");
  return data.languages || [];
};

export const runTyphonCode = (payload) =>
  request("/api/typhon/run", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const submitProblem = (problemId, payload) =>
  request(`/api/problems/${encodeURIComponent(problemId)}/submit`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

const DAY_MS = 24 * 60 * 60 * 1000;

const getLocalDateKey = (value) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const calculateRollingStreak = (activityRows = []) => {
  const activityDates = activityRows
    .map((row) => row.created_at || row.activity_date)
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((date) => Number.isFinite(date.getTime()))
    .sort((first, second) => second - first);

  if (activityDates.length === 0) return 0;

  const latestActivity = activityDates[0];
  if (Date.now() - latestActivity.getTime() > DAY_MS) {
    return 0;
  }

  const activeDays = new Set(activityDates.map(getLocalDateKey));
  const cursor = new Date(latestActivity);
  cursor.setHours(0, 0, 0, 0);

  let streak = 0;
  while (activeDays.has(getLocalDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
};

const loadUserActivityFromSupabase = async (userId) => {
  const { data, error } = await supabase
    .from("user_activity")
    .select("id, activity_type, problem_id, activity_date, metadata, created_at")
    .eq("user_id", String(userId))
    .eq("activity_type", "problem_submission")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) throw error;

  return {
    activity: data || [],
    streakDays: calculateRollingStreak(data || []),
    activeDays: new Set((data || []).map((item) => item.activity_date)).size,
    lastSolvedAt: data?.[0]?.created_at || null,
  };
};

export const loadUserProblemStats = async (userId) => {
  if (!userId) {
    return {
      activity: [],
      streakDays: 0,
      activeDays: 0,
      lastSolvedAt: null,
    };
  }

  try {
    return await request(
      `/api/users/${encodeURIComponent(userId)}/problem-stats`
    );
  } catch {
    return loadUserActivityFromSupabase(userId);
  }
};

const PUBLIC_PROBLEM_FIELDS = [
  "id",
  "title",
  "difficulty",
  "description",
  "input_format",
  "output_format",
  "examples",
  "constraints",
  "starter_code",
  "expected_time_complexity",
  "expected_space_complexity",
  "xp_reward",
  "submission_count",
  "accepted_count",
].join(",");

const calculateAcceptance = (problem) => {
  const submissions = Number(problem.submission_count || 0);
  const accepted = Number(problem.accepted_count || 0);
  return submissions ? `${((accepted / submissions) * 100).toFixed(1)}%` : "0.0%";
};

const loadProblemsFromSupabase = async (userId, problemId = "") => {
  let problemQuery = supabase.from("problems").select(PUBLIC_PROBLEM_FIELDS);
  if (problemId) problemQuery = problemQuery.eq("id", problemId);

  const { data: problemData, error: problemError } = await problemQuery;

  if (problemError) {
    throw new Error(
      problemError.code === "PGRST205" || problemError.code === "42P01"
        ? "Run backend/problem-schema.sql in Supabase to create the problem catalog."
        : problemError.message
    );
  }

  if (!problemData?.length) {
    throw new Error(
      "The Supabase problem catalog is empty. Run backend/problem-schema.sql again to seed the problems."
    );
  }

  const difficultyOrder = { Easy: 0, Medium: 1, Hard: 2, Extreme: 3 };

  return problemData
    .map((problem) => {
      return {
        ...problem,
        acceptance: calculateAcceptance(problem),
        solved: false,
        attempts: 0,
        bestRuntimeMs: null,
      };
    })
    .sort(
      (first, second) =>
        (difficultyOrder[first.difficulty] ?? 99) -
          (difficultyOrder[second.difficulty] ?? 99) ||
        first.title.localeCompare(second.title)
    );
};
