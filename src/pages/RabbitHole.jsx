import { useNavigate } from "react-router-dom";
import { LEARNING_PATHS } from "../data/learningPaths";
import "../styles/RabbitHole.css";

export default function RabbitHole() {
  const navigate = useNavigate();

  return (
    <div className="rabbit-page">
      <header className="rabbit-header">
        <button
          className="rabbit-back-button"
          type="button"
          onClick={() => navigate("/home")}
        >
          Back
        </button>
        <div>
          <span className="rabbit-eyebrow">Guided learning maps</span>
          <h1>Rabbit Hole</h1>
          <p>
            Pick a trail. Each step takes you from the surface into deeper
            concepts.
          </p>
        </div>
        <div className="rabbit-depth-key">
          <strong>4</strong>
          <span>available trails</span>
        </div>
      </header>

      <main>
        <section className="rabbit-intro">
          <div>
            <span>At the surface</span>
            <h2>You are the rabbit. Follow a trail into the technical depths.</h2>
          </div>
          <div className="rabbit-surface-status">
            <div>
              <strong>28</strong>
              <span>learning depths</span>
            </div>
            <div>
              <strong>180</strong>
              <span>guided hours</span>
            </div>
            <div>
              <strong>4</strong>
              <span>deep cores</span>
            </div>
          </div>
        </section>

        <section className="trail-grid" aria-label="Learning paths">
          {LEARNING_PATHS.map((path, index) => (
            <button
              className="trail-card"
              style={{ "--trail-accent": path.accent }}
              type="button"
              key={path.id}
              onClick={() => navigate(`/rabbit-hole/${path.id}`)}
            >
              <span className="trail-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="trail-card-heading">
                <span>{path.shortName}</span>
                <strong>{path.stages.length} depths</strong>
              </div>
              <h2>{path.name}</h2>
              <p>{path.description}</p>
              <div className="trail-card-footer">
                <span>{path.estimatedHours} guided hours</span>
                <b aria-hidden="true">→</b>
              </div>
            </button>
          ))}
        </section>
      </main>
    </div>
  );
}
