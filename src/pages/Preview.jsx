import { useNavigate } from "react-router-dom";
import heroImage from "../assets/code-arena-hero.png";
import SpaceCodeScene from "../components/SpaceCodeScene";

const features = [
  {
    number: "01",
    title: "Solve real challenges",
    text: "Search by difficulty, open a focused workspace, and judge code through the self-hosted Typhon engine.",
  },
  {
    number: "02",
    title: "Build your rank",
    text: "Turn completed problems into XP, track progress, and climb competitive rankings.",
  },
  {
    number: "03",
    title: "Compete together",
    text: "Join clans, compare team XP, message friends, and create group chats.",
  },
];

const stack = ["React", "Supabase", "Socket.IO", "Typhon"];

export default function Preview() {
  const navigate = useNavigate();

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
            <span className="preview-scene-status">
              <i />
              Orbital challenge network online
            </span>
            <span className="hero-kicker">Code. Compete. Connect.</span>
            <h1>CodeArena</h1>
            <p>
              A gamified coding space where every problem builds skill, XP, and
              your place in the arena.
            </p>

            <div className="hero-actions">
              <button
                className="button-primary button-large"
                onClick={() => navigate("/signup")}
              >
                Enter the arena
              </button>
              <a className="button-outline button-large" href="#explore">
                Explore the game
              </a>
            </div>

            <div className="hero-stats">
              <div>
                <strong>3</strong>
                <span>difficulty tiers</span>
              </div>
              <div>
                <strong>Live</strong>
                <span>friend and group chat</span>
              </div>
              <div>
                <strong>Self-hosted</strong>
                <span>code execution</span>
              </div>
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
              <div className="scoreboard-row">
                <strong>01</strong>
                <span>Binary Force</span>
                <b>12,840 XP</b>
              </div>
              <div className="scoreboard-row">
                <strong>02</strong>
                <span>Runtime Rebels</span>
                <b>11,920 XP</b>
              </div>
              <div className="scoreboard-row">
                <strong>03</strong>
                <span>Stack Masters</span>
                <b>10,475 XP</b>
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
