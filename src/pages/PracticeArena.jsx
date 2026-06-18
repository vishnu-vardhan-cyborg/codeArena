import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Bug,
  Check,
  CheckCircle2,
  Code2,
  Flame,
  Search,
  ShieldCheck,
  Target,
  Trophy,
} from "lucide-react";
import { loadProblems } from "../features/problems/problemApi";
import "../styles/PracticeArena.css";

const difficultyFilters = ["All", "Easy", "Medium", "Hard", "Extreme"];

const bugSnippet = `function containsDuplicate(nums) {
  for (let i = 0; i <= nums.length; i++) {
    if (seen.has(nums[i])) return true;
    seen.add(nums[i]);
  }
  return false;
}`;

const parseAcceptance = (acceptance = "0%") =>
  Number.parseFloat(String(acceptance).replace("%", "")) || 0;

export default function PracticeArena() {
  const navigate = useNavigate();
  const [currentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("loggedInUser") || "null");
    } catch {
      return null;
    }
  });
  const [problems, setProblems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("All");

  useEffect(() => {
    let active = true;

    loadProblems(currentUser?.id)
      .then((loadedProblems) => {
        if (!active) return;
        setProblems(loadedProblems);
        setLoadError("");
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(error.message);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentUser?.id]);

  const filteredProblems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return problems.filter((problem) => {
      const matchesDifficulty =
        difficulty === "All" || problem.difficulty === difficulty;
      const matchesSearch =
        !query ||
        (problem.title || "").toLowerCase().includes(query) ||
        (problem.difficulty || "").toLowerCase().includes(query);

      return matchesDifficulty && matchesSearch;
    });
  }, [difficulty, problems, search]);

  const stats = useMemo(() => {
    const solved = problems.filter((problem) => problem.solved).length;
    const totalXp = problems.reduce(
      (sum, problem) => sum + Number(problem.xp_reward || 0),
      0
    );
    const averageAcceptance =
      problems.length === 0
        ? 0
        : problems.reduce(
            (sum, problem) => sum + parseAcceptance(problem.acceptance),
            0
          ) / problems.length;
    const byDifficulty = problems.reduce(
      (counts, problem) => ({
        ...counts,
        [problem.difficulty]: (counts[problem.difficulty] || 0) + 1,
      }),
      {}
    );

    return {
      solved,
      total: problems.length,
      totalXp,
      averageAcceptance,
      byDifficulty,
    };
  }, [problems]);

  const dailyProblem =
    problems.find((problem) => !problem.solved && problem.difficulty === "Medium") ||
    problems.find((problem) => !problem.solved) ||
    problems[0];

  return (
    <div className="page practice-arena-page">
      <header className="practice-arena-header">
        <span className="practice-eyebrow">Practice arena</span>
        <h1>Solve center</h1>
        <p>
          Daily debugging on the left, problems in the middle, and progress
          stats on the right.
        </p>
      </header>

      <div className="practice-arena-layout">
        <aside className="daily-challenge-panel">
          <div className="practice-panel-heading">
            <span>Daily challenge</span>
            <h2>Bug Hunt</h2>
          </div>
          <p>
            Identify the bug before running code. Today&apos;s focus is boundary
            control and missing setup.
          </p>
          <pre>{bugSnippet}</pre>
          <div className="daily-clue-list">
            <div>
              <Bug size={15} />
              <span>One line steps outside the array.</span>
            </div>
            <div>
              <ShieldCheck size={15} />
              <span>One helper value is never initialized.</span>
            </div>
          </div>
          <button
            type="button"
            disabled={!dailyProblem}
            onClick={() =>
              dailyProblem && navigate(`/problems/${dailyProblem.id}`)
            }
          >
            Open special problem
            <ArrowRight size={16} />
          </button>
        </aside>

        <main className="practice-problem-panel">
          <div className="practice-panel-heading practice-problem-heading">
            <div>
              <span>Problem section</span>
              <h2>Choose a challenge</h2>
            </div>
            <strong>
              {isLoading ? "Loading" : `${filteredProblems.length} shown`}
            </strong>
          </div>

          <div className="practice-problem-tools">
            <label className="home-search-field">
              <Search size={17} />
              <input
                type="search"
                placeholder="Search problems"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <div className="difficulty-filter" aria-label="Difficulty filter">
              {difficultyFilters.map((filter) => (
                <button
                  className={difficulty === filter ? "active-filter" : ""}
                  type="button"
                  key={filter}
                  onClick={() => setDifficulty(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="practice-problem-list">
            {isLoading ? (
              <p className="practice-empty-state">Loading problem catalog...</p>
            ) : loadError ? (
              <p className="practice-empty-state">{loadError}</p>
            ) : filteredProblems.length === 0 ? (
              <p className="practice-empty-state">No matching problems.</p>
            ) : (
              filteredProblems.map((problem, index) => (
                <button
                  className="practice-problem-row"
                  type="button"
                  key={problem.id}
                  onClick={() => navigate(`/problems/${problem.id}`)}
                >
                  <span className="problem-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <strong>{problem.title}</strong>
                    <span>
                      Acceptance {problem.acceptance} /{" "}
                      <b className="problem-xp">{problem.xp_reward} XP</b>
                      {problem.solved && (
                        <span className="problem-solved" title="Solved">
                          <Check size={15} strokeWidth={3} />
                        </span>
                      )}
                    </span>
                  </div>
                  <span
                    className={`difficulty-badge ${(
                      problem.difficulty || "Easy"
                    ).toLowerCase()}`}
                  >
                    {problem.difficulty}
                  </span>
                  <ArrowRight size={17} />
                </button>
              ))
            )}
          </div>
        </main>

        <aside className="practice-stats-panel">
          <div className="practice-panel-heading">
            <span>Your stats</span>
            <h2>Progress board</h2>
          </div>

          <div className="practice-stat-list">
            <article>
              <CheckCircle2 size={18} />
              <span>Solved</span>
              <strong>
                {stats.solved}/{stats.total}
              </strong>
            </article>
            <article>
              <Trophy size={18} />
              <span>Available XP</span>
              <strong>{stats.totalXp}</strong>
            </article>
            <article>
              <Target size={18} />
              <span>Acceptance avg</span>
              <strong>{stats.averageAcceptance.toFixed(1)}%</strong>
            </article>
            <article>
              <Flame size={18} />
              <span>Daily focus</span>
              <strong>{dailyProblem?.difficulty || "Ready"}</strong>
            </article>
          </div>

          <div className="difficulty-breakdown">
            {["Easy", "Medium", "Hard", "Extreme"].map((item) => (
              <div key={item}>
                <span>{item}</span>
                <strong>{stats.byDifficulty[item] || 0}</strong>
              </div>
            ))}
          </div>

          <div className="practice-tip-card">
            <Code2 size={18} />
            <p>
              Special problems will later connect to Judge0/Typhon scoring and
              bug-identification missions.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
