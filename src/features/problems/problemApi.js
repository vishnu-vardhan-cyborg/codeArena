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

const SEEDED_PROBLEM_TOPICS = {
  "two-sum": ["Array", "Hash Map"],
  "valid-parentheses": ["String", "Stack"],
  "longest-substring": ["String", "Sliding Window", "Hash Set"],
  "group-anagrams": ["String", "Hash Map", "Sorting"],
  "merge-k-lists": ["Linked List", "Heap", "Divide and Conquer"],
  "trapping-rain-water": ["Array", "Two Pointers", "Prefix"],
  "contains-duplicate": ["Array", "Hash Set"],
  "best-time-stock": ["Array", "Greedy"],
  "valid-palindrome": ["String", "Two Pointers"],
  "binary-search": ["Array", "Binary Search"],
  "fibonacci-mod": ["Math", "Dynamic Programming"],
  "product-except-self": ["Array", "Prefix", "Suffix"],
  "top-k-frequent": ["Hash Map", "Heap", "Sorting"],
  "coin-change": ["Dynamic Programming", "BFS"],
  "number-of-islands": ["Graph", "DFS", "BFS", "Matrix"],
  "rotate-matrix": ["Matrix", "Simulation"],
  "course-schedule": ["Graph", "Topological Sort"],
  "decode-ways": ["String", "Dynamic Programming"],
  "minimum-window-substring": ["String", "Sliding Window", "Hash Map"],
  "word-ladder": ["Graph", "BFS", "String"],
  "largest-rectangle-histogram": ["Array", "Stack"],
  "edit-distance": ["String", "Dynamic Programming"],
  "median-two-sorted-arrays": ["Array", "Binary Search"],
  "regular-expression-matching": ["String", "Dynamic Programming"],
  "n-queens-count": ["Backtracking", "Bitmask"],
  "shortest-path-obstacles": ["Graph", "BFS", "Matrix"],
};

const getFallbackTopics = (problem = {}) => {
  const byId = SEEDED_PROBLEM_TOPICS[problem.id];
  if (byId) return byId;

  const title = String(problem.title || "").toLowerCase();
  if (title.includes("substring") || title.includes("palindrome")) {
    return ["String", "Two Pointers"];
  }
  if (title.includes("matrix") || title.includes("island")) {
    return ["Matrix", "Graph"];
  }
  if (title.includes("stock") || title.includes("sum")) {
    return ["Array", "Hash Map"];
  }
  if (title.includes("course") || title.includes("path")) {
    return ["Graph", "BFS"];
  }
  if (title.includes("coin") || title.includes("decode")) {
    return ["Dynamic Programming"];
  }

  return ["Array"];
};

const hydrateProblemTopics = (problem) => ({
  ...problem,
  topics:
    Array.isArray(problem.topics) && problem.topics.length > 0
      ? problem.topics
      : getFallbackTopics(problem),
});

const toProblemQueryString = (userId, options = {}) => {
  const params = new URLSearchParams();

  if (userId) params.set("userId", userId);
  if (options.page) params.set("page", options.page);
  if (options.pageSize) params.set("pageSize", options.pageSize);
  if (options.search) params.set("search", options.search);
  if (options.difficulty && options.difficulty !== "All") {
    params.set("difficulty", options.difficulty);
  }
  if (options.topic && options.topic !== "All") {
    params.set("topic", options.topic);
  }

  const query = params.toString();
  return query ? `?${query}` : "";
};

export const loadProblems = async (userId) => {
  try {
    const query = toProblemQueryString(userId);
    const data = await request(`/api/problems${query}`);
    if (Array.isArray(data.problems)) {
      return data.problems.map(hydrateProblemTopics);
    }
  } catch {
    // The public catalog can safely fall back to Supabase. Hidden tests cannot.
  }

  return loadProblemsFromSupabase(userId);
};

export const loadProblemPage = async (userId, options = {}) => {
  const pageSize = Number(options.pageSize || 10);
  const page = Number(options.page || 1);

  try {
    const data = await request(
      `/api/problems${toProblemQueryString(userId, {
        ...options,
        page,
        pageSize,
      })}`
    );

    const returnedProblems = (
      Array.isArray(data.problems) ? data.problems : []
    ).map(hydrateProblemTopics);
    const hasPagingMetadata =
      data.total !== undefined || data.totalPages !== undefined;

    if (!hasPagingMetadata && returnedProblems.length > pageSize) {
      const filteredProblems = filterProblemCatalog(returnedProblems, options);
      const start = (page - 1) * pageSize;

      return {
        problems: filteredProblems.slice(start, start + pageSize),
        total: filteredProblems.length,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(filteredProblems.length / pageSize)),
        topics: buildTopicCounts(returnedProblems),
      };
    }

    return {
      problems: returnedProblems.slice(0, pageSize),
      total: Number(data.total ?? returnedProblems.length),
      page: Number(data.page || page),
      pageSize: Number(data.pageSize || pageSize),
      totalPages: Number(data.totalPages || 1),
      topics: data.topics?.length ? data.topics : buildTopicCounts(returnedProblems),
    };
  } catch {
    const allProblems = await loadProblemsFromSupabase(userId);
    const filteredProblems = filterProblemCatalog(allProblems, options);
    const start = (page - 1) * pageSize;

    return {
      problems: filteredProblems.slice(start, start + pageSize),
      total: filteredProblems.length,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(filteredProblems.length / pageSize)),
      topics: buildTopicCounts(allProblems),
    };
  }
};

export const loadProblem = async (problemId, userId) => {
  try {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    const data = await request(
      `/api/problems/${encodeURIComponent(problemId)}${query}`
    );
    if (data.problem) return hydrateProblemTopics(data.problem);
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

export const loadProblemEditorial = async (problemId) => {
  try {
    const data = await request(
      `/api/problems/${encodeURIComponent(problemId)}/editorial`
    );
    return data.editorial || null;
  } catch {
    const { data, error } = await supabase
      .from("problem_editorials")
      .select(
        "problem_id, topics, overview, approach, solution_python, solution_java, complexity_notes, updated_at"
      )
      .eq("problem_id", problemId)
      .maybeSingle();

    if (error) return null;
    return data || null;
  }
};

export const loadProblemSubmissions = async (problemId, userId) => {
  if (!userId) {
    return {
      submissions: [],
      latestSubmission: null,
    };
  }

  try {
    const data = await request(
      `/api/problems/${encodeURIComponent(problemId)}/submissions?userId=${encodeURIComponent(
        userId
      )}`
    );
    return {
      submissions: data.submissions || [],
      latestSubmission: data.latestSubmission || null,
    };
  } catch {
    return {
      submissions: [],
      latestSubmission: null,
    };
  }
};

export const loadProblemNote = async (problemId, userId) => {
  if (!userId) return null;

  try {
    const data = await request(
      `/api/problems/${encodeURIComponent(problemId)}/notes?userId=${encodeURIComponent(
        userId
      )}`
    );
    return data.note || null;
  } catch {
    return null;
  }
};

export const saveProblemNote = async (problemId, payload) => {
  const data = await request(`/api/problems/${encodeURIComponent(problemId)}/notes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.note || null;
};

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
  "topics",
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

const buildTopicCounts = (problems = []) => {
  const counts = new Map();

  problems.forEach((problem) => {
    (Array.isArray(problem.topics) ? problem.topics : []).forEach((topic) => {
      counts.set(topic, (counts.get(topic) || 0) + 1);
    });
  });

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort(
      (first, second) =>
        second.count - first.count || first.name.localeCompare(second.name)
    );
};

const filterProblemCatalog = (problems = [], options = {}) => {
  const search = String(options.search || "").trim().toLowerCase();
  const difficulty = String(options.difficulty || "All");
  const topic = String(options.topic || "All");

  return problems.filter((problem) => {
    const problemTopics = Array.isArray(problem.topics) ? problem.topics : [];
    const matchesDifficulty =
      difficulty === "All" || problem.difficulty === difficulty;
    const matchesTopic = topic === "All" || problemTopics.includes(topic);
    const matchesSearch =
      !search ||
      (problem.title || "").toLowerCase().includes(search) ||
      (problem.difficulty || "").toLowerCase().includes(search) ||
      problemTopics.join(" ").toLowerCase().includes(search);

    return matchesDifficulty && matchesTopic && matchesSearch;
  });
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
        ...hydrateProblemTopics(problem),
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
