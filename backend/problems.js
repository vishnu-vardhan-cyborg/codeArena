const { supabase, publicSupabase, hasServiceRole } = require("./supabase");
const { executeTyphon } = require("./typhon");

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

const normalizeOutput = (value) =>
  String(value || "")
    .replace(/\r\n/g, "\n")
    .trim();

const outputsMatch = (actual, expected, checkerType) => {
  const normalizedActual = normalizeOutput(actual);
  const normalizedExpected = normalizeOutput(expected);

  if (checkerType === "exact") {
    return normalizedActual === normalizedExpected;
  }

  if (checkerType === "unordered_lines") {
    const normalizeLines = (value) =>
      value
        .split("\n")
        .map((line) => line.trim().split(/\s+/).filter(Boolean).join(" "))
        .filter(Boolean)
        .sort();

    return (
      JSON.stringify(normalizeLines(normalizedActual)) ===
      JSON.stringify(normalizeLines(normalizedExpected))
    );
  }

  return (
    JSON.stringify(normalizedActual.split(/\s+/).filter(Boolean)) ===
    JSON.stringify(normalizedExpected.split(/\s+/).filter(Boolean))
  );
};

const estimateComplexity = (sourceCode = "") => {
  const source = String(sourceCode);
  const loopCount = (source.match(/\b(for|while)\b/g) || []).length;
  const hasSort = /\b(sort|sorted|Arrays\.sort|Collections\.sort)\b/.test(source);
  const hasNestedLoop =
    /for[\s\S]{0,220}\b(for|while)\b|while[\s\S]{0,220}\b(for|while)\b/.test(
      source
    );
  const hasCollection =
    /\b(dict|set|list|Map|Set|HashMap|HashSet|ArrayList|PriorityQueue|heapq)\b/.test(
      source
    );
  const hasRecursion = /\bdef\s+(\w+)[\s\S]*\b\1\s*\(|static\s+\w+\s+(\w+)\s*\([^)]*\)[\s\S]*\b\2\s*\(/.test(
    source
  );

  let time = "O(1)";
  if (hasNestedLoop) time = "O(n^2) estimated";
  else if (hasSort) time = "O(n log n) estimated";
  else if (loopCount > 0 || hasRecursion) time = "O(n) estimated";

  const space =
    hasCollection || hasRecursion ? "O(n) estimated" : "O(1) estimated";

  return { time, space };
};

const calculateAcceptance = (problem) => {
  const submissions = Number(problem.submission_count || 0);
  const accepted = Number(problem.accepted_count || 0);
  return submissions ? `${((accepted / submissions) * 100).toFixed(1)}%` : "0.0%";
};

const toPublicProblem = (problem, progress) => ({
  ...problem,
  acceptance: calculateAcceptance(problem),
  solved: Boolean(progress?.solved_at),
  attempts: Number(progress?.attempts || 0),
  bestRuntimeMs: progress?.best_runtime_ms ?? null,
});

const getUserProgress = async (userId, problemIds) => {
  if (!hasServiceRole || !userId || problemIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("user_problem_progress")
    .select("problem_id, attempts, solved_at, best_runtime_ms")
    .eq("user_id", String(userId))
    .in("problem_id", problemIds);

  if (error) return new Map();
  return new Map((data || []).map((item) => [item.problem_id, item]));
};

const listProblems = async (userId) => {
  const { data, error } = await publicSupabase
    .from("problems")
    .select(PUBLIC_PROBLEM_FIELDS)
    .order("difficulty", { ascending: true })
    .order("title", { ascending: true });

  if (error) throw error;

  const progress = await getUserProgress(
    userId,
    (data || []).map((problem) => problem.id)
  );

  const difficultyOrder = { Easy: 0, Medium: 1, Hard: 2 };

  return (data || [])
    .map((problem) => toPublicProblem(problem, progress.get(problem.id)))
    .sort(
      (first, second) =>
        difficultyOrder[first.difficulty] - difficultyOrder[second.difficulty] ||
        first.title.localeCompare(second.title)
    );
};

const getProblem = async (problemId, userId) => {
  const { data, error } = await publicSupabase
    .from("problems")
    .select(PUBLIC_PROBLEM_FIELDS)
    .eq("id", problemId)
    .single();

  if (error) throw error;

  const progress = await getUserProgress(userId, [problemId]);
  return toPublicProblem(data, progress.get(problemId));
};

const judgeSubmission = async ({
  problemId,
  userId,
  language,
  sourceCode,
}) => {
  if (!hasServiceRole) {
    const error = new Error(
      "Problem submission requires SUPABASE_SECRET_KEY (recommended) or legacy SUPABASE_SERVICE_ROLE_KEY on the backend so hidden tests remain private."
    );
    error.statusCode = 503;
    throw error;
  }

  if (!userId) throw new Error("A logged-in user is required to submit");

  const [
    { data: problem, error: problemError },
    { data: tests, error: testError },
    { data: previousProgress },
  ] = await Promise.all([
    supabase
      .from("problems")
      .select(PUBLIC_PROBLEM_FIELDS)
      .eq("id", problemId)
      .single(),
    supabase
      .from("problem_test_cases")
      .select("id, stdin, expected_output, checker_type")
      .eq("problem_id", problemId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("user_problem_progress")
      .select("solved_at")
      .eq("user_id", String(userId))
      .eq("problem_id", problemId)
      .maybeSingle(),
  ]);

  if (problemError || testError) {
    const failure = problemError || testError;
    if (failure.message?.toLowerCase().includes("invalid api key")) {
      const error = new Error(
        "The backend Supabase admin key is invalid. Set SUPABASE_SECRET_KEY to an sb_secret_... key, or use the legacy SUPABASE_SERVICE_ROLE_KEY, then restart the backend."
      );
      error.statusCode = 503;
      throw error;
    }
    throw failure;
  }
  if (!tests?.length) throw new Error("This problem has no judge test cases");

  let status = "Accepted";
  let passedTests = 0;
  let executedTests = 0;
  let runtimeMs = 0;
  let errorMessage = "";

  for (const test of tests) {
    let result;

    try {
      result = await executeTyphon({
        language,
        sourceCode,
        stdin: test.stdin,
      });
    } catch (error) {
      status = "Internal Error";
      errorMessage = error.message;
      break;
    }

    runtimeMs += Number(result.elapsed_time_ms || 0);
    executedTests += 1;

    if (result.timed_out) {
      status = "Time Limit Exceeded";
      errorMessage = "Execution exceeded Typhon's time limit.";
      break;
    }

    if (Number(result.exit_code) !== 0) {
      status =
        language === "java" && /error:/i.test(result.stderr || "")
          ? "Compilation Error"
          : "Runtime Error";
      errorMessage = String(result.stderr || "Execution failed").slice(0, 2000);
      break;
    }

    if (!outputsMatch(result.stdout, test.expected_output, test.checker_type)) {
      status = "Wrong Answer";
      errorMessage = "Output did not match a hidden test case.";
      break;
    }

    passedTests += 1;
  }

  const complexity = estimateComplexity(sourceCode);
  const averageRuntime = runtimeMs / Math.max(executedTests, 1);
  const { data: submission, error: submissionError } = await supabase
    .from("problem_submissions")
    .insert({
      problem_id: problemId,
      user_id: String(userId),
      language,
      source_code: String(sourceCode),
      status,
      passed_tests: passedTests,
      total_tests: tests.length,
      runtime_ms: Number(averageRuntime.toFixed(2)),
      estimated_time_complexity: complexity.time,
      estimated_space_complexity: complexity.space,
      error_message: errorMessage || null,
    })
    .select("*")
    .single();

  if (submissionError) throw submissionError;

  const [
    { data: updatedProblem },
    { data: updatedUser },
    { data: updatedProgress },
  ] = await Promise.all([
    supabase
      .from("problems")
      .select("submission_count, accepted_count")
      .eq("id", problemId)
      .single(),
    supabase.from("lusers").select("xp").eq("id", userId).single(),
    supabase
      .from("user_problem_progress")
      .select("attempts, solved_at, best_runtime_ms, xp_awarded")
      .eq("user_id", String(userId))
      .eq("problem_id", problemId)
      .single(),
  ]);

  const firstSolve = status === "Accepted" && !previousProgress?.solved_at;

  return {
    submissionId: submission.id,
    status,
    passedTests,
    totalTests: tests.length,
    runtimeMs: Number(averageRuntime.toFixed(2)),
    errorMessage,
    expectedComplexity: {
      time: problem.expected_time_complexity,
      space: problem.expected_space_complexity,
    },
    estimatedComplexity: complexity,
    acceptance: calculateAcceptance(updatedProblem || problem),
    solved: Boolean(updatedProgress?.solved_at),
    attempts: Number(updatedProgress?.attempts || 0),
    bestRuntimeMs: updatedProgress?.best_runtime_ms ?? null,
    xpAwarded: firstSolve ? Number(problem.xp_reward || 0) : 0,
    totalXp: Number(updatedUser?.xp || 0),
  };
};

module.exports = {
  getProblem,
  judgeSubmission,
  listProblems,
};
