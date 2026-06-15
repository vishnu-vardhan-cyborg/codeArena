import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  BookOpen,
  CheckCircle2,
  Code2,
  Flame,
  Gamepad2,
  Home as HomeIcon,
  Hourglass,
  LogOut,
  Menu,
  MessageCircle,
  PenSquare,
  Search,
  Settings,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  UsersRound,
  X,
} from "lucide-react";
import { supabase } from "../supabase";
import { loadProblems } from "../features/problems/problemApi";
import "../styles/Home.css";

const mainNavigation = [
  { label: "Home", path: "/home", icon: HomeIcon, active: true },
  { label: "Clans", path: "/clans", icon: Shield },
  { label: "Time Capsules", path: "/time-capsules", icon: Hourglass },
  { label: "Chat", path: "/chat", icon: MessageCircle },
  { label: "Rabbit Hole", path: "/rabbit-hole", icon: BookOpen },
  { label: "Power Up Hunt", path: "/power-up-hunt", icon: Gamepad2 },
];

const quickActions = [
  {
    label: "Solve a problem",
    detail: "Practice with Typhon",
    target: "problems",
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

const difficultyFilters = ["All", "Easy", "Medium", "Hard"];

export default function Home() {
  const navigate = useNavigate();
  const [currentUser] = useState(
    () => JSON.parse(localStorage.getItem("loggedInUser")) || {}
  );
  const [sidebarOpen, setSidebarOpen] = useState(
    () => window.innerWidth >= 980
  );
  const [search, setSearch] = useState("");
  const [problemSearch, setProblemSearch] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("All");
  const [problems, setProblems] = useState([]);
  const [problemLoadError, setProblemLoadError] = useState("");
  const [problemsLoading, setProblemsLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState("");
  const debounceTimer = useRef(null);

  const goTo = (path) => {
    navigate(path);
    if (window.innerWidth < 980) {
      setSidebarOpen(false);
    }
  };

  const logout = () => {
    const savedTheme = localStorage.getItem("codeArenaTheme");
    localStorage.clear();
    if (savedTheme) {
      localStorage.setItem("codeArenaTheme", savedTheme);
    }
    navigate("/login");
  };

  const searchUsers = async (value) => {
    setSearch(value);

    if (!value.trim()) {
      setUsers([]);
      return;
    }

    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from("lusers")
        .select("*")
        .ilike("username", `%${value}%`)
        .neq("id", currentUser.id);

      let results = data || [];

      if (results.length > 0) {
        const [
          { data: friendRelations },
          { data: followRelations },
        ] = await Promise.all([
          supabase.from("friends").select("*"),
          supabase
            .from("user_follows")
            .select("following_id")
            .eq("follower_id", String(currentUser.id)),
        ]);
        const currentUserId = String(currentUser.id);
        const friendIds = new Set(
          (friendRelations || [])
            .filter(
              (relation) =>
                String(relation.user1_id) === currentUserId ||
                String(relation.user2_id) === currentUserId
            )
            .map((relation) =>
              String(
                String(relation.user1_id) === currentUserId
                  ? relation.user2_id
                  : relation.user1_id
              )
            )
        );
        const followingIds = new Set(
          (followRelations || []).map((relation) =>
            String(relation.following_id)
          )
        );

        results = results.map((user) => ({
          ...user,
          isFriend: friendIds.has(String(user.id)),
          isFollowing: followingIds.has(String(user.id)),
        }));
      }

      setUsers(results);
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

  const sendFriendRequest = async (receiverId) => {
    setMessage("");

    const { data: existing } = await supabase
      .from("friend_requests")
      .select("*")
      .eq("sender_id", currentUser.id)
      .eq("receiver_id", receiverId)
      .in("status", ["pending", "accepted"]);

    if (existing?.length > 0) {
      setMessage("Request already sent");
      return;
    }

    const { error } = await supabase.from("friend_requests").insert([
      {
        sender_id: currentUser.id,
        receiver_id: receiverId,
        status: "pending",
      },
    ]);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Friend request sent");
  };

  const toggleFollow = async (user) => {
    setMessage("");
    const relation = {
      follower_id: String(currentUser.id),
      following_id: String(user.id),
    };

    const { error } = user.isFollowing
      ? await supabase
          .from("user_follows")
          .delete()
          .eq("follower_id", relation.follower_id)
          .eq("following_id", relation.following_id)
      : await supabase.from("user_follows").insert([relation]);

    if (error) {
      setMessage(
        error.code === "PGRST205" || error.code === "42P01"
          ? "Run backend/social-schema.sql in Supabase to enable following."
          : error.message
      );
      return;
    }

    setUsers((currentUsers) =>
      currentUsers.map((currentResult) =>
        String(currentResult.id) === String(user.id)
          ? { ...currentResult, isFollowing: !user.isFollowing }
          : currentResult
      )
    );
    setMessage(user.isFollowing ? "Unfollowed player" : "Following player");
  };

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

  const level = Math.floor(Number(currentUser.xp || 0) / 100) + 1;
  const levelProgress = Number(currentUser.xp || 0) % 100;

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

      <aside className="home-sidebar">
        <div className="home-sidebar-brand">
          <span>CA</span>
          <strong>CodeArena</strong>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <button
          className="home-player-summary"
          type="button"
          aria-label="Open profile"
          onClick={() => goTo("/profile")}
        >
          {currentUser.profile_pic ? (
            <img src={currentUser.profile_pic} alt="" />
          ) : (
            <span>
              {(currentUser.uusername || currentUser.username || "P")[0]}
            </span>
          )}
          <div>
            <strong>{currentUser.uusername || currentUser.username}</strong>
            <small>{currentUser.xp || 0} XP</small>
          </div>
        </button>

        <nav className="home-primary-nav" aria-label="Main navigation">
          <span className="home-nav-label">Arena</span>
          {mainNavigation.map(({ label, path, icon: Icon, active }) => (
            <button
              className={active ? "active-home-nav" : ""}
              type="button"
              key={path}
              onClick={() => goTo(path)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
          <button type="button" onClick={() => goTo("/profile#posts")}>
            <PenSquare size={18} />
            <span>Post</span>
          </button>
        </nav>

        <nav className="home-account-nav" aria-label="Account navigation">
          <span className="home-nav-label">Account</span>
          <button type="button" onClick={() => goTo("/notifications")}>
            <Bell size={18} />
            <span>Notifications</span>
          </button>
          <button
            className="settings-nav"
            type="button"
            title="Settings is coming soon"
            disabled
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>
          <button className="logout-nav" type="button" onClick={logout}>
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </nav>
      </aside>

      <div className="home-content">
        <header className="home-topbar">
          <button
            className="home-menu-button"
            type="button"
            aria-label="Open navigation"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen((open) => !open)}
          >
            <Menu size={21} />
          </button>
          <div>
            <span>Player dashboard</span>
            <h1>Welcome {currentUser.uusername || currentUser.username}</h1>
          </div>
          <button
            className="power-hunt-shortcut"
            type="button"
            onClick={() => navigate("/power-up-hunt")}
          >
            <Gamepad2 size={18} />
            Power Up Hunt
          </button>
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
                <span>Daily focus</span>
                <strong>1 problem</strong>
              </article>
              <article>
                <Trophy size={18} />
                <span>Current XP</span>
                <strong>{currentUser.xp || 0}</strong>
              </article>
              <article>
                <BookOpen size={18} />
                <span>Learning trails</span>
                <strong>4 paths</strong>
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
                          Acceptance {problem.acceptance} · {problem.xp_reward} XP
                        </span>
                      </div>
                      {problem.solved && (
                        <span className="problem-solved" title="Solved">
                          <CheckCircle2 size={15} />
                        </span>
                      )}
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

                {message && <p className="home-inline-message">{message}</p>}

                <div className="users-grid">
                  {search.trim() &&
                    users.map((user) => (
                      <article key={user.id} className="user-card">
                        <span className="user-card-avatar">
                          {(user.uusername || user.username || "P")[0]}
                        </span>
                        <div>
                          <h3>{user.uusername || user.username}</h3>
                          <p>{user.age ? `Age ${user.age}` : "Arena player"}</p>
                        </div>

                        <div className="home-user-actions">
                          {user.isFriend ? (
                            <button className="disabled" disabled>
                              Buddy
                            </button>
                          ) : (
                            <button onClick={() => sendFriendRequest(user.id)}>
                              Add
                            </button>
                          )}
                          <button
                            className={user.isFollowing ? "following" : ""}
                            onClick={() => toggleFollow(user)}
                          >
                            {user.isFollowing ? "Following" : "Follow"}
                          </button>
                        </div>
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
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
