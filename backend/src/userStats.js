const { supabase } = require("./supabase");

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date) => {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
};

const toDateKey = (value) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const calculateSolvedStreak = (solvedAtValues = []) => {
  const solvedDates = solvedAtValues
    .map((value) => new Date(value))
    .filter((date) => Number.isFinite(date.getTime()))
    .sort((first, second) => second - first);

  if (solvedDates.length === 0) return 0;

  const latestSolve = solvedDates[0];
  if (Date.now() - latestSolve.getTime() > DAY_MS) {
    return 0;
  }

  const solvedDays = new Set(solvedDates.map(toDateKey));
  const cursor = startOfDay(latestSolve);
  let streak = 0;

  while (solvedDays.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
};

const getUserProblemStats = async (userId) => {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    return {
      streakDays: 0,
      lastSolvedAt: null,
      activeDays: 0,
      activity: [],
    };
  }

  const { data, error } = await supabase
    .from("problem_submissions")
    .select("id, problem_id, language, status, runtime_ms, created_at")
    .eq("user_id", normalizedUserId)
    .eq("status", "Accepted")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) throw error;

  const acceptedSubmissions = data || [];
  const activity = acceptedSubmissions.map((submission) => ({
    id: submission.id,
    user_id: normalizedUserId,
    activity_type: "problem_submission",
    problem_id: submission.problem_id,
    activity_date: toDateKey(submission.created_at),
    created_at: submission.created_at,
    metadata: {
      languageName: submission.language,
      status: submission.status,
      runtimeMs: submission.runtime_ms,
      submissionId: submission.id,
    },
  }));

  return {
    streakDays: calculateSolvedStreak(
      acceptedSubmissions.map((submission) => submission.created_at)
    ),
    lastSolvedAt: acceptedSubmissions[0]?.created_at || null,
    activeDays: new Set(activity.map((item) => item.activity_date)).size,
    activity,
  };
};

module.exports = {
  calculateSolvedStreak,
  getUserProblemStats,
};
