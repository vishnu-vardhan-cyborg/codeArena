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

  const difficultyOrder = { Easy: 0, Medium: 1, Hard: 2 };

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
        difficultyOrder[first.difficulty] - difficultyOrder[second.difficulty] ||
        first.title.localeCompare(second.title)
    );
};
