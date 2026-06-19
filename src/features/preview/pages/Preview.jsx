import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import heroImage from "../../../assets/code-arena-hero.png";
import SpaceCodeScene from "../../../shared/components/SpaceCodeScene";

const features = [
  {
    number: "01",
    art: "solve",
    title: "Solve real challenges",
    text: "Practice by difficulty, open a focused workspace, and code with the self-hosted Typhon engine.",
  },
  {
    number: "02",
    art: "rank",
    title: "Build your rank",
    text: "Turn completed problems into XP, track progress, and climb competitive rankings.",
  },
  {
    number: "03",
    art: "team",
    title: "Compete together",
    text: "Join clans, compare team XP, message friends, and create group chats.",
  },
];

const stack = ["React", "Supabase", "Socket.IO", "Typhon"];
const rankingFrames = [
  [
    { id: "binary-force", name: "Binary Force", xp: 12840 },
    { id: "runtime-rebels", name: "Runtime Rebels", xp: 11920 },
    { id: "stack-masters", name: "Stack Masters", xp: 10475 },
  ],
  [
    { id: "runtime-rebels", name: "Runtime Rebels", xp: 13210 },
    { id: "binary-force", name: "Binary Force", xp: 12840 },
    { id: "stack-masters", name: "Stack Masters", xp: 11160 },
  ],
  [
    { id: "stack-masters", name: "Stack Masters", xp: 13620 },
    { id: "runtime-rebels", name: "Runtime Rebels", xp: 13440 },
    { id: "binary-force", name: "Binary Force", xp: 13080 },
  ],
  [
    { id: "binary-force", name: "Binary Force", xp: 14680 },
    { id: "runtime-rebels", name: "Runtime Rebels", xp: 13980 },
    { id: "stack-masters", name: "Stack Masters", xp: 13620 },
  ],
];
const seasonAscii = String.raw`
███████╗███████╗ █████╗ ███████╗ ██████╗ ███╗   ██╗
██╔════╝██╔════╝██╔══██╗██╔════╝██╔═══██╗████╗  ██║
███████╗█████╗  ███████║███████╗██║   ██║██╔██╗ ██║
╚════██║██╔══╝  ██╔══██║╚════██║██║   ██║██║╚██╗██║
███████║███████╗██║  ██║███████║╚██████╔╝██║ ╚████║
╚══════╝╚══════╝╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝  ╚═══╝`;
const getRankedTeams = (teams) =>
  [...teams].sort((left, right) => right.xp - left.xp);

const getRankMap = (teams) =>
  Object.fromEntries(
    getRankedTeams(teams).map((team, index) => [team.id, index + 1])
  );

const formatXp = (xp) => xp.toLocaleString("en-US");

function LiveXpCounter({ from, to }) {
  const [displayValue, setDisplayValue] = useState(from);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion || from === to) {
      setDisplayValue(to);
      return undefined;
    }

    let animationFrame = 0;
    const duration = 2600;
    const startTime = performance.now();
    const difference = to - from;

    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(from + difference * easedProgress));

      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(tick);
      }
    };

    animationFrame = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(animationFrame);
  }, [from, to]);

  return (
    <b className="xp-live-counter" aria-label={`${formatXp(to)} XP`}>
      {formatXp(displayValue)} XP
    </b>
  );
}

export default function Preview() {
  const navigate = useNavigate();
  const [rankingFrame, setRankingFrame] = useState(0);
  const [previousRanks, setPreviousRanks] = useState(
    () => getRankMap(rankingFrames[0])
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRankingFrame((currentFrame) => {
        setPreviousRanks(getRankMap(rankingFrames[currentFrame]));
        return (currentFrame + 1) % rankingFrames.length;
      });
    }, 4800);

    return () => window.clearInterval(timer);
  }, []);

  const rankingRows = useMemo(() => {
    const previousFrame =
      rankingFrames[
        (rankingFrame - 1 + rankingFrames.length) % rankingFrames.length
      ];
    const previousScores = Object.fromEntries(
      previousFrame.map((team) => [team.id, team.xp])
    );

    return getRankedTeams(rankingFrames[rankingFrame]).map((team, index) => {
      const rank = index + 1;
      const previousRank = previousRanks[team.id] || rank;
      const scoreChange = team.xp - (previousScores[team.id] || team.xp);
      const motion =
        previousRank > rank
          ? "rank-up"
          : previousRank < rank
            ? "rank-down"
            : scoreChange > 0
              ? "rank-score"
              : "rank-hold";

      return {
        ...team,
        motion,
        previousXp: previousScores[team.id] || team.xp,
        rank,
        scoreChange,
      };
    });
  }, [previousRanks, rankingFrame]);

  return (
    <div className="preview-page">
      <header className="preview-nav">
        <button className="brand-button" onClick={() => window.scrollTo(0, 0)}>
          <span className="brand-mark">&lt;/&gt;</span>
          <span>CodeArena</span>
        </button>

        <nav className="preview-links" aria-label="Preview navigation">
          <a href="#explore">Explore</a>
          <a href="#developers">Developers</a>
        </nav>

        <div className="preview-actions">
          <button className="button-quiet" onClick={() => navigate("/login")}>
            Log in
          </button>
          <button className="button-primary" onClick={() => navigate("/signup")}>
            Create account
          </button>
        </div>
      </header>

      <main>
        <section className="preview-hero">
          <SpaceCodeScene />
          <img
            className="preview-hero-fallback"
            src={heroImage}
            alt="A digital coding arena with challenge platforms"
          />
          <div className="preview-hero-overlay" />

          <div className="preview-hero-content">
            <span className="hero-kicker">Code. Compete. Conquer.</span>
            <h1 className="preview-title">CodeArena</h1>
            <div className="season-mark" aria-label="Season 1">
              <pre className="season-ascii">{seasonAscii}</pre>
              <strong>01</strong>
            </div>
            <p>
              A professional gaming-style coding arena with ranked problems,
              pixel missions, clans, chat, and self-hosted execution.
            </p>

            <div className="front-terminal" aria-label="Arena boot status">
              <code>system.scan --profile player</code>
              <code>typhon.engine online</code>
              <code>ranked.practice unlocked</code>
            </div>

            <div className="hero-actions">
              <button
                className="button-primary button-large"
                onClick={() => navigate("/signup")}
              >
                Start game
              </button>
              <a className="button-outline button-large" href="#explore">
                View systems
              </a>
            </div>

          </div>
        </section>

        <section className="preview-section" id="explore">
          <div className="preview-section-heading">
            <span>How it plays</span>
            <h2>Progress that feels earned</h2>
            <p>
              Start with a challenge, execute your solution, and build a
              competitive profile alongside friends.
            </p>
          </div>

          <div className="feature-grid">
            {features.map((feature) => (
              <article className="feature-item" key={feature.number}>
                <span>{feature.number}</span>
                <div
                  className={`feature-card-art ${feature.art}`}
                  aria-hidden="true"
                >
                  <i />
                  <b />
                  <em />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>

          <div className="arena-preview">
            <div className="arena-preview-copy">
              <span className="section-label">One connected arena</span>
              <h2>Practice alone. Progress together.</h2>
              <p>
                Problems, profiles, clans, rankings, and chat live in the same
                workflow. No separate tools or disconnected progress.
              </p>
              <button className="button-primary" onClick={() => navigate("/signup")}>
                Create your profile
              </button>
            </div>

            <div className="arena-scoreboard">
              <div className="scoreboard-header">
                <span>Weekly clan ranking</span>
                <strong>Season 01</strong>
              </div>
              <div className="scoreboard-body" aria-live="polite">
                {rankingRows.map((team) => (
                  <div
                    className={`scoreboard-row animated-rank-row ${team.motion}`}
                    key={`${team.id}-${rankingFrame}`}
                  >
                    <strong>{String(team.rank).padStart(2, "0")}</strong>
                    <span>
                      {team.name}
                      <small>
                        {team.scoreChange > 0
                          ? `+${formatXp(team.scoreChange)} XP surge`
                          : "holding position"}
                      </small>
                    </span>
                    <LiveXpCounter from={team.previousXp} to={team.xp} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="developer-band" id="developers">
          <div>
            <span className="section-label">Developer details</span>
            <h2>Built as an extensible coding platform</h2>
            <p>
              The application separates realtime communication, persistent
              data, and sandboxed code execution so each part can evolve
              independently.
            </p>
          </div>

          <div className="stack-list">
            {stack.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>

          <button className="button-light" onClick={() => navigate("/signup")}>
            Start exploring
          </button>
        </section>
      </main>

      <footer className="preview-footer">
        <span className="brand-button">
          <span className="brand-mark">&lt;/&gt;</span>
          <span>CodeArena</span>
        </span>
        <p>Practice. Compete. Build together.</p>
        <button className="button-quiet" onClick={() => navigate("/login")}>
          Existing player? Log in
        </button>
      </footer>
    </div>
  );
}
