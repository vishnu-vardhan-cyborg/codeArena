import { useEffect, useState } from "react";
import { supabase } from "../../../shared/services/supabase";

export default function SubmissionHistory({ problemId, refreshKey }) {
  const [submissions, setSubmissions] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(true);

  useEffect(() => {
    async function loadSubmissions() {
      const user = JSON.parse(localStorage.getItem("loggedInUser") || "{}");

      if (!user.username) {
        setIsLoggedIn(false);
        setSubmissions([]);
        return;
      }

      setIsLoggedIn(true);

      const { data } = await supabase
        .from("problem_submissions")
        .select("*")
        .eq("problem_id", problemId)
        .eq("user_id", user.username)
        .order("created_at", {
          ascending: false,
        });

      setSubmissions(data || []);
    }

    loadSubmissions();
  }, [problemId, refreshKey]);

  if (!isLoggedIn) {
    return (
      <div className="empty-panel-state">
        Sign in to see your submission history.
      </div>
    );
  }

  if (!submissions.length) {
    return (
      <div className="empty-panel-state">
        No submissions yet. Run and submit a solution to see history here.
      </div>
    );
  }

  return (
    <div className="submission-history">
      {submissions.map((submission) => {
        const statusClass = (submission.status || "")
          .toLowerCase()
          .replace(/_/g, "-");

        return (
          <article key={submission.id} className="submission-card">
            <div className="submission-main">
              <span className={`submission-status ${statusClass}`}>
                {formatStatus(submission.status)}
              </span>
              <span>{submission.language}</span>
            </div>

            <div className="submission-meta">
              <span>{submission.runtime_ms ?? "-"} ms</span>
              <span>{new Date(submission.created_at).toLocaleString()}</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function formatStatus(status = "") {
  return status.replace(/_/g, " ").toLowerCase();
}
