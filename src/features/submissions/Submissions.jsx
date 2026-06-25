import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, FileText, Timer, Trophy } from "lucide-react";
import { supabase } from "../../shared/services/supabase";
import "../../styles/features/Submissions.css";

const formatStatus = (status = "") =>
  String(status || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Pending";

const getStatusClass = (status = "") =>
  String(status || "").toLowerCase().replace(/_/g, "-") || "pending";

const formatSubmittedAt = (value) =>
  value
    ? new Date(value).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

export default function Submissions() {
  const [submissions, setSubmissions] = useState([]);
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const loadSubmissions = useCallback(async () => {
    const user = JSON.parse(
      localStorage.getItem("loggedInUser") || "{}"
    );

    if (!user.username) {
      setSubmissions([]);
      setTotalSubmissions(0);
      setLoading(false);
      return;
    }

    const [countResult, recentResult] = await Promise.all([
      supabase
        .from("problem_submissions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.username),
      supabase
        .from("problem_submissions")
        .select(
          `
          *,
          problems (
            id,
            title,
            difficulty
          )
        `
        )
        .eq("user_id", user.username)
        .order("created_at", {
          ascending: false,
        })
        .limit(20),
    ]);

    if (countResult.error || recentResult.error) {
      setError(countResult.error?.message || recentResult.error?.message);
      setSubmissions([]);
      setTotalSubmissions(0);
    } else {
      const seenProblems = new Set();
      const recentProblems = [];

      (recentResult.data || []).forEach((submission) => {
        const problemKey =
          submission.problem_id || submission.problems?.id || submission.id;

        if (seenProblems.has(problemKey) || recentProblems.length >= 5) {
          return;
        }

        seenProblems.add(problemKey);
        recentProblems.push(submission);
      });

      setError("");
      setTotalSubmissions(countResult.count || 0);
      setSubmissions(recentProblems);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  if (loading) {
    return (
      <main className="submissions-page submissions-loading">
        Loading submissions...
      </main>
    );
  }

  return (
    <main className="submissions-page">
      <header className="submissions-header">
        <div>
          <span className="submissions-eyebrow">
            <FileText size={16} />
            Submissions
          </span>
          <h1>Submission Overview</h1>
          <p>Total all-time attempts with recent problem activity shown below.</p>
        </div>

        <button
          type="button"
          className="submissions-back-button"
          onClick={() => navigate("/profile")}
        >
          Back to profile
        </button>
      </header>

      <section className="submissions-stat-grid">
        <article>
          <Trophy size={18} />
          <span>Total submissions</span>
          <strong>{totalSubmissions}</strong>
          <small>All time</small>
        </article>
        <article>
          <Clock size={18} />
          <span>Showing</span>
          <strong>{submissions.length}</strong>
          <small>Recent problems</small>
        </article>
      </section>

      <section className="submissions-panel">
        <div className="submissions-panel-heading">
          <div>
            <span className="submissions-eyebrow">Latest attempts</span>
            <h2>Recents</h2>
          </div>
        </div>

        {error ? (
          <p className="submissions-state error">{error}</p>
        ) : submissions.length === 0 ? (
          <p className="submissions-state">No submissions yet.</p>
        ) : (
          <div className="submissions-table-wrap">
            <table className="submissions-table">
              <thead>
                <tr>
                  <th>Verdict</th>
                  <th>Problem</th>
                  <th>Language</th>
                  <th>Runtime</th>
                  <th>Submitted</th>
                </tr>
              </thead>

              <tbody>
                {submissions.map((submission) => (
                  <tr
                    key={submission.id}
                    onClick={() => navigate(`/submissions/${submission.id}`)}
                  >
                    <td>
                      <span
                        className={`submission-verdict ${getStatusClass(
                          submission.status
                        )}`}
                      >
                        {formatStatus(submission.status)}
                      </span>
                    </td>
                    <td>
                      <strong>
                        {submission.problems?.title || "Untitled problem"}
                      </strong>
                      <small>
                        {submission.problems?.difficulty || "Difficulty not set"}
                      </small>
                    </td>
                    <td>{submission.language || "-"}</td>
                    <td>
                      <span className="submission-runtime">
                        <Timer size={14} />
                        {submission.runtime_ms ?? "-"} ms
                      </span>
                    </td>
                    <td>{formatSubmittedAt(submission.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
