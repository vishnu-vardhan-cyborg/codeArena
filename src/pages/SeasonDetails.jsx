import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Flame,
  Trophy,
} from "lucide-react";
import "../styles/SeasonDetails.css";

const seasonTracks = [
  "Daily focused practice",
  "Reflection-based problem solving",
  "Clan progress checkpoints",
  "XP rewards for steady completion",
];

export default function SeasonDetails() {
  return (
    <div className="season-details-page">
      <section className="season-hero">
        <div>
          <span className="season-kicker">Season one</span>
          <h1>Bhagavad Gita</h1>
          <p>
            A focused season path for disciplined learning, steady practice,
            and progress with your arena network.
          </p>
        </div>
        <div className="season-mark-card" aria-hidden="true">
          <span>01</span>
          <strong>BG</strong>
        </div>
      </section>

      <main className="season-details-grid">
        <section className="season-overview-panel">
          <div className="season-panel-heading">
            <span>Season brief</span>
            <h2>What this season contains</h2>
          </div>
          <p>
            Bhagavad Gita is the first themed learning season. It will connect
            daily coding challenges with consistency goals, XP growth, and
            clan-based checkpoints.
          </p>
          <div className="season-track-list">
            {seasonTracks.map((track) => (
              <div key={track}>
                <CheckCircle2 size={16} />
                <span>{track}</span>
              </div>
            ))}
          </div>
        </section>

        <aside className="season-stats-panel">
          <article>
            <CalendarDays size={18} />
            <span>Duration</span>
            <strong>Coming soon</strong>
          </article>
          <article>
            <Flame size={18} />
            <span>Focus</span>
            <strong>Consistency</strong>
          </article>
          <article>
            <Trophy size={18} />
            <span>Rewards</span>
            <strong>XP + rank</strong>
          </article>
          <article>
            <BookOpen size={18} />
            <span>Path</span>
            <strong>Season story</strong>
          </article>
        </aside>
      </main>
    </div>
  );
}
