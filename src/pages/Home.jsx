import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Check,
  Code2,
  Flame,
  Gamepad2,
  Menu,
  ScrollText,
  Search,
  Sparkles,
  Swords,
  Target,
  Trophy,
  UsersRound,
} from "lucide-react";
import AppSidebar from "../components/AppSidebar";
import { supabase } from "../supabase";
import {
  loadProblems,
  loadUserProblemStats,
} from "../features/problems/problemApi";
import "../styles/Home.css";

const quickActions = [
  {
    label: "Solve a problem",
    detail: "Practice with Typhon",
    path: "/practice-arena",
    icon: Code2,
    tone: "coral",
  },
  {
    label: "Enter Rabbit Hole",
    detail: "Follow a learning trail",
    path: "/rabbit-hole",
    icon: BookOpen,
    tone: "teal",
  },
  {
    label: "Power Up Hunt",
    detail: "Recover forest cores",
    path: "/power-up-hunt",
    icon: Gamepad2,
    tone: "gold",
  },
  {
    label: "Challenge with clans",
    detail: "Build with your team",
    path: "/clans",
    icon: Swords,
    tone: "blue",
  },
];

const difficultyFilters = ["All", "Easy", "Medium", "Hard", "Extreme"];

const formatRank = (rank) => {
  const rankValue = Number(rank);
  if (!Number.isFinite(rankValue) || rankValue <= 0) return "Unranked";
  return `#${rankValue}`;
};

const getCountryValue = (user = {}) =>
  String(
    user.country ||
      user.country_code ||
      user.countryCode ||
      user.location_country ||
      user.nationality ||
      ""
  )
    .trim()
    .toLowerCase();

const buildRank = (users, currentUserId) => {
  const sortedUsers = [...users].sort((first, second) => {
    const xpDifference = Number(second.xp || 0) - Number(first.xp || 0);
    if (xpDifference !== 0) return xpDifference;
    return String(first.id).localeCompare(String(second.id));
  });

  const index = sortedUsers.findIndex(
    (user) => String(user.id) === String(currentUserId)
  );

  return index === -1 ? "Unranked" : formatRank(index + 1);
};

export default function Home() {
  const navigate = useNavigate();
  const [currentUser] = useState(
    () => JSON.parse(localStorage.getItem("loggedInUser")) || {}
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [problemSearch, setProblemSearch] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("All");
  const [problems, setProblems] = useState([]);
  const [problemLoadError, setProblemLoadError] = useState("");
  const [problemsLoading, setProblemsLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({
    streakDays: 0,
    globalRank: "Unranked",
    localRank: "No country",
  });
  const debounceTimer = useRef(null);

  const searchUsers = async (value) => {
    setSearch(value);

    const query = value.trim();

    if (!query) {
      setUsers([]);
      return;
    }

    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      const [emailResult, nameResult] = await Promise.all([
        supabase
          .from("lusers")
          .select("*")
          .ilike("username", `%${query}%`)
          .neq("id", currentUser.id),
        supabase
          .from("lusers")
          .select("*")
          .ilike("uusername", `%${query}%`)
          .neq("id", currentUser.id),
      ]);

      const resultsById = new Map();
      [...(emailResult.data || []), ...(nameResult.data || [])].forEach(
        (user) => {
          resultsById.set(String(user.id), user);
        }
      );

      setUsers([...resultsById.values()]);
    }, 500);
  };

  useEffect(() => {
    return () => clearTimeout(debounceTimer.current);
  }, []);

  useEffect(() => {
    let active = true;

    loadProblems(currentUser.id)
      .then((loadedProblems) => {
        if (!active) return;
        setProblems(loadedProblems);
        setProblemLoadError("");
      })
      .catch((error) => {
        if (!active) return;
        setProblemLoadError(error.message);
      })
      .finally(() => {
        if (active) setProblemsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentUser.id]);

  useEffect(() => {
    let active = true;
    const currentUserId = String(currentUser.id || "");

    if (!currentUserId) return () => {
      active = false;
    };

    const loadDashboardStats = async () => {
      const [userResult, problemStats] = await Promise.all([
        supabase.from("lusers").select("*"),
        loadUserProblemStats(currentUserId).catch(() => ({
          streakDays: 0,
          activity: [],
          activeDays: 0,
          lastSolvedAt: null,
        })),
      ]);

      if (!active) return;

      const allUsers = userResult.data || [];
      const currentProfile =
        allUsers.find((user) => String(user.id) === currentUserId) ||
        currentUser;
      const country = getCountryValue(currentProfile);
      const countryUsers = country
        ? allUsers.filter((user) => getCountryValue(user) === country)
        : [];

      setDashboardStats({
        streakDays: Number(problemStats.streakDays || 0),
        globalRank: userResult.error
          ? formatRank(currentProfile.global_rank || currentProfile.globalRank)
          : buildRank(allUsers, currentUserId),
        localRank: !country
          ? "No country"
          : userResult.error
          ? formatRank(currentProfile.local_rank || currentProfile.localRank)
          : buildRank(countryUsers, currentUserId),
      });
    };

    loadDashboardStats();

    return () => {
      active = false;
    };
  }, [currentUser]);

  const filteredProblems = problems.filter((problem) => {
    const query = problemSearch.trim().toLowerCase();
    const matchesDifficulty =
      difficultyFilter === "All" || problem.difficulty === difficultyFilter;

    return (
      matchesDifficulty &&
      (!query ||
        problem.title.toLowerCase().includes(query) ||
        problem.difficulty.toLowerCase().includes(query))
    );
  });

  const playerXp = Number(currentUser.xp || 0);
  const level = Math.floor(playerXp / 100) + 1;
  const levelProgress = playerXp % 100;

  const handleQuickAction = (action) => {
    if (action.path) {
      navigate(action.path);
      return;
    }

    document.getElementById(action.target)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div className={`home-shell ${sidebarOpen ? "sidebar-is-open" : ""}`}>
      <button
        className="home-sidebar-overlay"
        type="button"
        aria-label="Close navigation"
        onClick={() => setSidebarOpen(false)}
      />

      <AppSidebar onClose={() => setSidebarOpen(false)} />

      <div className="home-content">
        <header className="home-topbar">
          <button
            className="home-menu-button"
            type="button"
            aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen((open) => !open)}
          >
            <Menu size={21} />
          </button>
          <div>
            <span>Player dashboard</span>
            <h1>Welcome {currentUser.uusername || currentUser.username}</h1>
          </div>
          <div className="app-shell-nav-actions">
            <button
              className="power-hunt-shortcut"
              type="button"
              onClick={() => navigate("/power-up-hunt")}
            >
              <Gamepad2 size={18} />
              Power Up Hunt
            </button>
          </div>
        </header>

        <main className="home-main">
          <section className="home-command-band">
            <div className="home-command-copy">
              <span className="home-section-label">Your arena</span>
              <h2>Keep the momentum going.</h2>
              <p>
                Choose today&apos;s focus, build your streak, and keep moving
                deeper.
              </p>
              <div className="home-level-progress">
                <div>
                  <span>Level {level}</span>
                  <strong>{levelProgress}/100 XP</strong>
                </div>
                <div>
                  <span style={{ width: `${levelProgress}%` }} />
                </div>
              </div>
            </div>

            <div className="home-command-stats">
              <article>
                <Flame size={18} />
                <span>Streak</span>
                <strong>{dashboardStats.streakDays} days</strong>
              </article>
              <article>
                <Trophy size={18} />
                <span>Global ranking</span>
                <strong>{dashboardStats.globalRank}</strong>
              </article>
              <article>
                <Target size={18} />
                <span>Local ranking</span>
                <strong>{dashboardStats.localRank}</strong>
              </article>
            </div>
          </section>

          <section className="home-quick-section">
            <div className="home-section-heading">
              <div>
                <span className="home-section-label">Quick actions</span>
                <h2>Jump back in</h2>
              </div>
            </div>
            <div className="home-quick-grid">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    className={`home-quick-action ${action.tone}`}
                    type="button"
                    key={action.label}
                    onClick={() => handleQuickAction(action)}
                  >
                    <span className="home-quick-icon">
                      <Icon size={20} />
                    </span>
                    <span>
                      <strong>{action.label}</strong>
                      <small>{action.detail}</small>
                    </span>
                    <ArrowRight size={17} />
                  </button>
                );
              })}
            </div>
          </section>

          <div className="home-workspace">
            <section className="problem-browser home-dashboard-panel" id="problems">
              <div className="home-panel-heading">
                <div>
                  <span className="home-section-label">Practice arena</span>
                  <h2>Problem set</h2>
                  <p>Pick a challenge and judge your solution with Typhon.</p>
                </div>
                <strong>
                  {problemsLoading ? "Loading..." : `${filteredProblems.length} available`}
                </strong>
              </div>

              <div className="home-problem-tools">
                <label className="home-search-field">
                  <Search size={17} />
                  <input
                    className="problem-search"
                    type="search"
                    placeholder="Search problems"
                    value={problemSearch}
                    onChange={(event) => setProblemSearch(event.target.value)}
                  />
                </label>
                <div
                  className="difficulty-filter"
                  role="group"
                  aria-label="Problem difficulty"
                >
                  {difficultyFilters.map((difficulty) => (
                    <button
                      className={
                        difficultyFilter === difficulty ? "active-filter" : ""
                      }
                      type="button"
                      key={difficulty}
                      onClick={() => setDifficultyFilter(difficulty)}
                    >
                      {difficulty}
                    </button>
                  ))}
                </div>
              </div>

              <div className="problem-list">
                {problemsLoading ? (
                  <p className="empty-state">Loading problem catalog...</p>
                ) : problemLoadError ? (
                  <p className="empty-state">{problemLoadError}</p>
                ) : filteredProblems.length === 0 ? (
                  <p className="empty-state">No matching problems.</p>
                ) : (
                  filteredProblems.map((problem, index) => (
                    <button
                      className="problem-row"
                      key={problem.id}
                      onClick={() => navigate(`/problems/${problem.id}`)}
                    >
                      <span className="problem-index">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <strong>{problem.title}</strong>
                        <span>
                          Acceptance {problem.acceptance} ·{" "}
                          <b className="problem-xp">{problem.xp_reward} XP</b>
                          {problem.solved && (
                            <span className="problem-solved" title="Solved">
                              <Check size={15} strokeWidth={3} />
                            </span>
                          )}
                        </span>
                      </div>
                      <span
                        className={`difficulty-badge ${problem.difficulty.toLowerCase()}`}
                      >
                        {problem.difficulty}
                      </span>
                      <ArrowRight className="problem-arrow" size={17} />
                    </button>
                  ))
                )}
              </div>
            </section>

            <aside className="home-side-rail">
              <section className="user-search-section home-dashboard-panel">
                <div className="home-panel-heading compact">
                  <div>
                    <span className="home-section-label">Community</span>
                    <h2>Find friends</h2>
                    <p>Build your arena network.</p>
                  </div>
                  <UsersRound size={20} />
                </div>

                <label className="home-search-field">
                  <Search size={17} />
                  <input
                    type="search"
                    placeholder="Search players"
                    value={search}
                    onChange={(event) => searchUsers(event.target.value)}
                  />
                </label>

                <div className="users-grid">
                  {search.trim() &&
                    users.map((user) => (
                      <article key={user.id} className="user-card">
                        <button
                          className="user-card-profile-link"
                          type="button"
                          onClick={() => navigate(`/profile/${user.id}`)}
                        >
                          {user.profile_pic ? (
                            <img
                              className="user-card-avatar"
                              src={user.profile_pic}
                              alt=""
                            />
                          ) : (
                            <span className="user-card-avatar">
                              {(user.uusername || user.username || "P")[0]}
                            </span>
                          )}
                          <span>
                            <h3>{user.uusername || user.username}</h3>
                            <p>
                              {user.country || "Arena player"}
                              {user.age ? ` - Age ${user.age}` : ""}
                            </p>
                          </span>
                        </button>

                      </article>
                    ))}
                </div>
              </section>

              <section className="home-power-panel">
                <div>
                  <span className="home-section-label">Mini game</span>
                  <h2>Power Up Hunt</h2>
                  <p>Recover five power cores hidden in the forest.</p>
                </div>
                <Sparkles size={28} />
                <button type="button" onClick={() => navigate("/power-up-hunt")}>
                  Start hunt
                  <ArrowRight size={16} />
                </button>
              </section>

              <section className="home-season-panel">
                <div>
                  <span className="home-section-label">Season one</span>
                  <h2>Bhagavad Gita</h2>
                  <p>Open the first season path, rules, rewards, and challenge focus.</p>
                </div>
                <ScrollText size={28} />
                <button type="button" onClick={() => navigate("/season-one")}>
                  View details
                  <ArrowRight size={16} />
                </button>
              </section>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
