import { useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  CircleAlert,
  History,
  Star,
  Tag,
} from "lucide-react";
import SubmissionHistory from "./SubmissionHistory";

export default function ProblemDescription({
  problem,
  submissionRefreshKey,
  problemStatus,
}) {
  const [tab, setTab] = useState("description");

  return (
    <aside className="problem-description">
      <div className="problem-description-tabs" role="tablist" aria-label="Problem sections">
        <button
          type="button"
          className={`problem-tab-button ${tab === "description" ? "active" : ""}`}
          onClick={() => setTab("description")}
        >
          <BookOpen size={16} />
          Description
        </button>

        <button
          type="button"
          className={`problem-tab-button ${tab === "submissions" ? "active" : ""}`}
          onClick={() => setTab("submissions")}
        >
          <History size={16} />
          Submissions
        </button>
      </div>

      {tab === "description" && (
        <DescriptionContent problem={problem} problemStatus={problemStatus} />
      )}

      {tab === "submissions" && (
        <SubmissionHistory problemId={problem.id} refreshKey={submissionRefreshKey} />
      )}
    </aside>
  );
}

function DescriptionContent({ problem, problemStatus }) {
  const difficulty = (problem.difficulty || "").toLowerCase();

  return (
    <div className="problem-description-content">
      <div className="problem-title-row">
        <h1 className="problem-title">{problem.title}</h1>

        {problemStatus === "SOLVED" && (
          <span className="problem-status-badge solved">
            <CheckCircle2 size={15} />
            Solved
          </span>
        )}

        {problemStatus === "ATTEMPTED" && (
          <span className="problem-status-badge attempted">
            <CircleAlert size={15} />
            Attempted
          </span>
        )}
      </div>

      <div className="problem-meta-row">
        <span className={`problem-difficulty-badge ${difficulty}`}>
          {problem.difficulty}
        </span>

        <span className="problem-xp-badge">
          <Star size={15} />
          {problem.xp_reward} XP
        </span>
      </div>

      {problem.topics?.length > 0 && (
        <div className="problem-topic-list" aria-label="Problem topics">
          {problem.topics.map((topic) => (
            <span key={topic} className="problem-topic-pill">
              <Tag size={13} />
              {topic}
            </span>
          ))}
        </div>
      )}

      <p className="problem-statement">{problem.description}</p>

      {problem.constraints?.length > 0 && (
        <section className="problem-section">
          <h2 className="problem-section-title">Constraints</h2>
          <ul className="problem-constraints">
            {problem.constraints.map((constraint) => (
              <li key={constraint}>{constraint}</li>
            ))}
          </ul>
        </section>
      )}

      {problem.examples?.length > 0 && (
        <section className="problem-section">
          <h2 className="problem-section-title">Examples</h2>

          <div className="problem-examples">
            {problem.examples.map((example, index) => (
              <article key={index} className="problem-example-card">
                <div className="problem-example-label">Example {index + 1}</div>

                <div className="problem-example-block">
                  <span>Input</span>
                  <pre>{example.input}</pre>
                </div>

                <div className="problem-example-block">
                  <span>Output</span>
                  <pre>{example.output}</pre>
                </div>

                {example.explanation && (
                  <div className="problem-example-block">
                    <span>Explanation</span>
                    <pre>{example.explanation}</pre>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
