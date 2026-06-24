import { useEffect, useState } from "react";
import { supabase } from "../../../shared/services/supabase";

export default function SubmissionHistory({ problemId,refreshKey }) {
  const [submissions, setSubmissions] = useState([]);

  useEffect(() => {
    loadSubmissions();
    
  }, [problemId,refreshKey]);

  async function loadSubmissions() {
    const user = JSON.parse(
      localStorage.getItem("loggedInUser")
    );

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

  return (
    <div>
      {submissions.map((submission) => (
        <div
          key={submission.id}
          className="
            border
            border-zinc-700
            rounded
            p-3
            mb-3
          "
        >
          <div>
            {submission.status}
          </div>

          <div>
            {submission.language}
          </div>

          <div>
            {submission.runtime_ms} ms
          </div>

          <div>
            {new Date(
              submission.created_at
            ).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}