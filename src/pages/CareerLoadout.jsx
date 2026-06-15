import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  Award,
  Bolt,
  Braces,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Flame,
  Orbit,
  RadioTower,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  UsersRound,
} from "lucide-react";
import { supabase } from "../supabase";
import {
  buildCareerStats,
  buildMomentumPoints,
  buildRadarPoints,
} from "../features/careerLoadout/careerStats";
import "../styles/CareerLoadout.css";

const DEFAULT_AVATAR = "https://i.pravatar.cc/240?img=12";

const formatMissionDate = (value) =>
  value
    ? new Date(value).toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Recent";

export default function CareerLoadout() {
  const navigate = useNavigate();
  const [currentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("loggedInUser") || "null");
    } catch {
      return null;
    }
  });
  const currentUserId = currentUser?.id ? String(currentUser.id) : "";

  const [profile, setProfile] = useState(null);
  const [activity, setActivity] = useState([]);
  const [networkCounts, setNetworkCounts] = useState({
    friendsCount: 0,
    followersCount: 0,
    followingCount: 0,
    postsCount: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadCareerData = useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);

    const [
      profileResult,
      activityResult,
      friendsResult,
      followersResult,
      followingResult,
      postsResult,
    ] = await Promise.all([
      supabase.from("lusers").select("*").eq("id", currentUser.id).single(),
      supabase
        .from("user_activity")
        .select(
          "id, activity_type, problem_id, activity_date, metadata, created_at"
        )
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase.from("friends").select("user1_id, user2_id"),
      supabase
        .from("user_follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", currentUserId),
      supabase
        .from("user_follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", currentUserId),
      supabase
        .from("posts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", currentUserId),
    ]);

    const friendsCount = (friendsResult.data || []).filter(
      (relation) =>
        String(relation.user1_id) === currentUserId ||
        String(relation.user2_id) === currentUserId
    ).length;

    setProfile(profileResult.data || currentUser);
    setActivity(activityResult.data || []);
    setNetworkCounts({
      friendsCount,
      followersCount: followersResult.count || 0,
      followingCount: followingResult.count || 0,
      postsCount: postsResult.count || 0,
    });
    setLoading(false);
  }, [currentUser, currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      navigate("/login", { replace: true });
      return;
    }
    loadCareerData();
  }, [currentUserId, loadCareerData, navigate]);

  const stats = useMemo(
    () =>
      buildCareerStats({
        profile: profile || {},
        activity,
        ...networkCounts,
      }),
    [activity, networkCounts, profile]
  );
  const radarPoints = useMemo(
    () => buildRadarPoints(stats.axes),
    [stats.axes]
  );
  const momentumPoints = useMemo(
    () => buildMomentumPoints(stats.momentum),
    [stats.momentum]
  );

  if (loading || !profile) {
    return (
      <div className="page career-loadout-page career-loadout-loading">
        <Orbit size={28} />
        <strong>Assembling Career Loadout...</strong>
      </div>
    );
  }

  const name = profile.uusername || profile.username || "Arena Player";

  return (
    <div className="page career-loadout-page">
      <header className="loadout-topbar">
        <button type="button" onClick={() => navigate("/profile")}>
          <ArrowLeft size={17} />
          Profile
        </button>
        <div>
          <span>Live player telemetry</span>
          <strong>Career Loadout</strong>
        </div>
        <div className="loadout-online">
          <i />
          Signal online
        </div>
      </header>

      <main className="loadout-main">
        <section className="loadout-hero">
          <div className="loadout-grid-lines" />
          <div className="loadout-avatar-zone">
            <div className="loadout-avatar-orbit">
              <i />
              <img src={profile.profile_pic || DEFAULT_AVATAR} alt="" />
              <span>LVL {stats.level}</span>
            </div>
            <div>
              <span className="loadout-kicker">Active class</span>
              <h1>{stats.rankTitle}</h1>
              <p>{name}</p>
              <small>{profile.username}</small>
            </div>
          </div>

          <div className="loadout-power-zone">
            <div
              className="loadout-power-ring"
              style={{ "--power": `${stats.powerScore * 3.6}deg` }}
            >
              <span>
                <strong>{stats.powerScore}</strong>
                <small>Power</small>
              </span>
            </div>
            <div className="loadout-xp-track">
              <div>
                <span>{stats.xp} total XP</span>
                <strong>{stats.nextLevelXp} XP to level {stats.level + 1}</strong>
              </div>
              <i>
                <span style={{ width: `${stats.xp % 100}%` }} />
              </i>
            </div>
          </div>
        </section>

        <section className="loadout-stat-strip" aria-label="Career stats">
          {[
            {
              label: "Problems mapped",
              value: stats.uniqueProblems,
              icon: Braces,
              tone: "teal",
            },
            {
              label: "Successful runs",
              value: stats.acceptedRuns,
              icon: Bolt,
              tone: "coral",
            },
            {
              label: "Active days",
              value: stats.activeDays,
              icon: CalendarDays,
              tone: "gold",
            },
            {
              label: "Current streak",
              value: stats.currentStreak,
              icon: Flame,
              tone: "green",
            },
            {
              label: "Network reach",
              value: stats.friendsCount + stats.followersCount,
              icon: UsersRound,
              tone: "blue",
            },
          ].map(({ label, value, icon: Icon, tone }) => (
            <article className={tone} key={label}>
              <Icon size={17} />
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </section>

        <div className="loadout-dashboard">
          <section className="loadout-panel ability-matrix">
            <div className="loadout-panel-heading">
              <div>
                <span>Capability scan</span>
                <h2>Ability Matrix</h2>
              </div>
              <RadioTower size={19} />
            </div>

            <div className="ability-layout">
              <svg
                className="ability-radar"
                viewBox="0 0 240 240"
                role="img"
                aria-label="Capability radar chart"
              >
                {[82, 61, 40, 20].map((radius) => (
                  <circle cx="120" cy="120" r={radius} key={radius} />
                ))}
                {stats.axes.map((axis, index) => {
                  const angle =
                    -Math.PI / 2 + (Math.PI * 2 * index) / stats.axes.length;
                  return (
                    <line
                      key={axis.key}
                      x1="120"
                      y1="120"
                      x2={120 + Math.cos(angle) * 82}
                      y2={120 + Math.sin(angle) * 82}
                    />
                  );
                })}
                <polygon points={radarPoints} />
                {radarPoints.split(" ").map((point, index) => {
                  const [cx, cy] = point.split(",");
                  return <circle className="radar-node" cx={cx} cy={cy} r="4" key={stats.axes[index].key} />;
                })}
              </svg>

              <div className="ability-score-list">
                {stats.axes.map((axis) => (
                  <div key={axis.key}>
                    <span>{axis.label}</span>
                    <i>
                      <span style={{ width: `${axis.value}%` }} />
                    </i>
                    <strong>{axis.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="loadout-panel momentum-panel">
            <div className="loadout-panel-heading">
              <div>
                <span>12-week output</span>
                <h2>Momentum Signal</h2>
              </div>
              <Activity size={19} />
            </div>
            <div className="momentum-chart">
              <svg viewBox="0 0 560 160" preserveAspectRatio="none">
                <line x1="18" y1="142" x2="542" y2="142" />
                <line x1="18" y1="88" x2="542" y2="88" />
                <line x1="18" y1="34" x2="542" y2="34" />
                <polyline points={momentumPoints} />
              </svg>
              <div>
                {stats.momentum.map((item) => (
                  <span key={item.label}>{item.label}</span>
                ))}
              </div>
            </div>
            <div className="momentum-callout">
              <Trophy size={20} />
              <span>
                <strong>{stats.longestStreak} day peak streak</strong>
                Longest sustained coding sequence
              </span>
            </div>
          </section>

          <section className="loadout-panel skill-loadout">
            <div className="loadout-panel-heading">
              <div>
                <span>Equipped stack</span>
                <h2>Language Loadout</h2>
              </div>
              <Swords size={19} />
            </div>
            {stats.languages.length === 0 ? (
              <p className="loadout-empty">Complete successful runs to reveal your language loadout.</p>
            ) : (
              <div className="language-loadout-list">
                {stats.languages.map((language, index) => (
                  <article key={language.name}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{language.name}</strong>
                      <i>
                        <span style={{ width: `${language.mastery}%` }} />
                      </i>
                    </div>
                    <small>{language.runs} runs</small>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="loadout-panel influence-panel">
            <div className="loadout-panel-heading">
              <div>
                <span>Arena presence</span>
                <h2>Influence Array</h2>
              </div>
              <Sparkles size={19} />
            </div>
            <div className="influence-orbit">
              <div>
                <RadioTower size={20} />
                <strong>{stats.followersCount}</strong>
                <span>Followers</span>
              </div>
              <div>
                <UsersRound size={20} />
                <strong>{stats.friendsCount}</strong>
                <span>Friends</span>
              </div>
              <div>
                <Orbit size={20} />
                <strong>{stats.followingCount}</strong>
                <span>Following</span>
              </div>
              <div>
                <Braces size={20} />
                <strong>{stats.postsCount}</strong>
                <span>Knowledge drops</span>
              </div>
            </div>
          </section>
        </div>

        <section className="loadout-panel achievements-panel">
          <div className="loadout-panel-heading">
            <div>
              <span>{stats.unlockedAchievements}/{stats.achievements.length} unlocked</span>
              <h2>Achievement Vault</h2>
            </div>
            <Award size={19} />
          </div>
          <div className="achievement-grid">
            {stats.achievements.map((achievement) => (
              <article
                className={achievement.unlocked ? "unlocked" : ""}
                key={achievement.name}
              >
                <div>
                  {achievement.unlocked ? (
                    <ShieldCheck size={20} />
                  ) : (
                    <CircleDot size={20} />
                  )}
                  <span>{achievement.unlocked ? "Unlocked" : `${achievement.progress}%`}</span>
                </div>
                <strong>{achievement.name}</strong>
                <p>{achievement.detail}</p>
                <i>
                  <span style={{ width: `${achievement.progress}%` }} />
                </i>
              </article>
            ))}
          </div>
        </section>

        <section className="loadout-panel mission-log">
          <div className="loadout-panel-heading">
            <div>
              <span>Verified activity</span>
              <h2>Mission Log</h2>
            </div>
            <CheckCircle2 size={19} />
          </div>
          {stats.recentMissions.length === 0 ? (
            <p className="loadout-empty">No completed missions recorded yet.</p>
          ) : (
            <div className="mission-list">
              {stats.recentMissions.map((mission) => (
                <article key={mission.id}>
                  <span>
                    <CheckCircle2 size={16} />
                  </span>
                  <div>
                    <strong>{mission.title}</strong>
                    <small>{mission.language}</small>
                  </div>
                  <em>{mission.status}</em>
                  <time>{formatMissionDate(mission.createdAt)}</time>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
