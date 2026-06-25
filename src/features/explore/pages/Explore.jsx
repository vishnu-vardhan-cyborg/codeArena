import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  Brain,
  Compass,
  Gamepad2,
  GraduationCap,
  Hourglass,
  Medal,
  Shield,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { supabase } from "../../../shared/services/supabase";
import "../../../styles/features/Explore.css";

const getDisplayName = (user) => user?.uusername || user?.username || "Arena player";

const getCollegeName = (user) => String(user?.college_name || "").trim();

const exploreItems = [
  {
    title: "Practice Arena",
    eyebrow: "Problems",
    description: "Solve curated challenges and keep your submissions moving.",
    path: "/practice-arena",
    icon: Brain,
  },
  {
    title: "Aura Farming",
    eyebrow: "Posts",
    description: "Create learning drops and build aura through useful shares.",
    path: "/aura-farming",
    icon: Sparkles,
  },
  {
    title: "Clans",
    eyebrow: "Teams",
    description: "Find a clan, compare XP, and compete with a roster.",
    path: "/clans",
    icon: Shield,
  },
  {
    title: "Time Capsules",
    eyebrow: "Commitments",
    description: "Join focused learning runs with friends and room codes.",
    path: "/time-capsules",
    icon: Hourglass,
  },
  {
    title: "Rabbit Hole",
    eyebrow: "Learning",
    description: "Follow guided paths and keep deeper study organized.",
    path: "/rabbit-hole",
    icon: BookOpen,
  },
  {
    title: "Power Up Hunt",
    eyebrow: "Arcade",
    description: "Collect powerups for attacks, shields, and arena boosts.",
    path: "/power-up-hunt",
    icon: Gamepad2,
  },
];

export default function Explore() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [progressRows, setProgressRows] = useState([]);
  const [isLoadingRankings, setIsLoadingRankings] = useState(true);
  const [rankingError, setRankingError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadCollegeRankings() {
      setIsLoadingRankings(true);
      setRankingError("");

      const [userResult, progressResult] = await Promise.all([
        supabase
          .from("lusers")
          .select("id, username, uusername, profile_pic, xp, country, profile_type, college_name"),
        supabase
          .from("user_problem_progress")
          .select("user_id, solved_at, attempts, xp_awarded"),
      ]);

      if (!active) return;

      if (userResult.error) {
        setRankingError(userResult.error.message);
        setUsers([]);
        setProgressRows([]);
      } else {
        setUsers(userResult.data || []);
        setProgressRows(progressResult.error ? [] : progressResult.data || []);
      }

      setIsLoadingRankings(false);
    }

    loadCollegeRankings();

    return () => {
      active = false;
    };
  }, []);

  const collegeRankings = useMemo(() => {
    const progressByUserKey = {};

    progressRows.forEach((row) => {
      const userKey = String(row.user_id || "");
      if (!userKey) return;

      if (!progressByUserKey[userKey]) {
        progressByUserKey[userKey] = {
          solvedCount: 0,
          attempts: 0,
          xpAwarded: 0,
        };
      }

      progressByUserKey[userKey].attempts += Number(row.attempts || 0);
      progressByUserKey[userKey].xpAwarded += Number(row.xp_awarded || 0);

      if (row.solved_at) {
        progressByUserKey[userKey].solvedCount += 1;
      }
    });

    const collegeMap = new Map();

    users.forEach((user) => {
      const collegeName = getCollegeName(user);
      if (!collegeName) return;

      const idKey = String(user.id || "");
      const usernameKey = String(user.username || "");
      const progress =
        progressByUserKey[idKey] || progressByUserKey[usernameKey] || {};
      const userXp = Number(user.xp || progress.xpAwarded || 0);
      const existing =
        collegeMap.get(collegeName) || {
          name: collegeName,
          country: user.country || "",
          memberCount: 0,
          totalXp: 0,
          solvedCount: 0,
          attempts: 0,
          topPlayers: [],
        };

      existing.memberCount += 1;
      existing.totalXp += userXp;
      existing.solvedCount += Number(progress.solvedCount || 0);
      existing.attempts += Number(progress.attempts || 0);
      existing.topPlayers.push({
        id: idKey || usernameKey,
        name: getDisplayName(user),
        xp: userXp,
      });

      collegeMap.set(collegeName, existing);
    });

    return [...collegeMap.values()]
      .map((college) => ({
        ...college,
        topPlayers: college.topPlayers
          .sort((first, second) => second.xp - first.xp || first.name.localeCompare(second.name))
          .slice(0, 3),
      }))
      .sort(
        (first, second) =>
          second.totalXp - first.totalXp ||
          second.solvedCount - first.solvedCount ||
          second.memberCount - first.memberCount ||
          first.name.localeCompare(second.name)
      )
      .map((college, index) => ({
        ...college,
        rank: index + 1,
      }));
  }, [progressRows, users]);

  const rankingSummary = useMemo(() => {
    const totalPlayers = collegeRankings.reduce(
      (total, college) => total + college.memberCount,
      0
    );

    return {
      colleges: collegeRankings.length,
      players: totalPlayers,
      leader: collegeRankings[0]?.name || "No leader yet",
    };
  }, [collegeRankings]);

  return (
    <main className="page explore-page">
      <header className="explore-page-header">
        <div>
          <span className="explore-eyebrow">
            <Compass size={16} />
            Explore
          </span>
          <h1>Explore</h1>
          <p>Choose the next arena surface to enter.</p>
        </div>
        <div className="explore-rank-card">
          <Trophy size={18} />
          <span>CodeArena</span>
          <strong>Discovery Hub</strong>
        </div>
      </header>

      <section className="explore-grid" aria-label="Explore CodeArena">
        {exploreItems.map(({ title, eyebrow, description, path, icon: Icon }) => (
          <button
            type="button"
            className="explore-card"
            key={path}
            onClick={() => navigate(path)}
          >
            <span className="explore-card-icon">
              <Icon size={21} />
            </span>
            <span>
              <small>{eyebrow}</small>
              <strong>{title}</strong>
              <em>{description}</em>
            </span>
          </button>
        ))}
      </section>

      <section className="college-ranking-panel" aria-label="College rankings">
        <div className="college-ranking-heading">
          <div>
            <span className="explore-eyebrow">
              <GraduationCap size={16} />
              College Ranking
            </span>
            <h2>College Leaderboard</h2>
            <p>
              Colleges are ranked by combined player XP, solved problems, and
              active members.
            </p>
          </div>
          <div className="college-ranking-summary">
            <span>
              <Medal size={15} />
              {rankingSummary.leader}
            </span>
            <strong>{rankingSummary.colleges} colleges</strong>
            <small>{rankingSummary.players} ranked players</small>
          </div>
        </div>

        {isLoadingRankings ? (
          <p className="college-ranking-state">Loading college rankings...</p>
        ) : rankingError ? (
          <p className="college-ranking-state error">{rankingError}</p>
        ) : collegeRankings.length === 0 ? (
          <p className="college-ranking-state">
            No college data yet. Student profiles with a college name will appear
            here.
          </p>
        ) : (
          <div className="college-ranking-list">
            {collegeRankings.map((college) => (
              <article className="college-ranking-row" key={college.name}>
                <strong>#{college.rank}</strong>
                <span className="college-ranking-name">
                  <b>{college.name}</b>
                  <small>
                    {college.country || "Global"} - {college.solvedCount} solves
                    - {college.attempts} attempts
                  </small>
                  {college.topPlayers.length > 0 && (
                    <small>
                      Top players:{" "}
                      {college.topPlayers.map((player) => player.name).join(", ")}
                    </small>
                  )}
                </span>
                <span className="college-ranking-members">
                  <Users size={15} />
                  {college.memberCount}
                </span>
                <b>{college.totalXp} XP</b>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
