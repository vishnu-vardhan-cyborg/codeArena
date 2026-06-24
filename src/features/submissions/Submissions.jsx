import { useEffect, useState } from "react";
import { supabase } from "../../shared/services/supabase";
import { useNavigate } from "react-router-dom";

export default function Submissions() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    loadSubmissions();
  }, []);

  async function loadSubmissions() {
    const user = JSON.parse(
      localStorage.getItem("loggedInUser")
    );

    const { data, error } = await supabase
      .from("problem_submissions")
      .select(`
        *,
        problems (
          id,
          title,
          difficulty
        )
      `)
      .eq("user_id", user.username)
      .order("created_at", {
        ascending: false,
      });

    if (!error) {
      setSubmissions(data || []);
    }

    setLoading(false);
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-6">
      <h1
        style={{
          fontSize: "24px",
          marginBottom: "20px",
        }}
      >
        Submission History
      </h1>

      <table
        style={{
          width: "100%",
        }}
      >
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
          {submissions.map((s) => (
            <tr
              key={s.id}
              style={{
                cursor: "pointer",
              }}
              onClick={() =>
                navigate(
                  `/submissions/${s.id}`
                )
              }
            >
              <td>{s.status}</td>

              <td>
                {s.problems?.title}
              </td>

              <td>{s.language}</td>

              <td>
                {s.runtime_ms ?? "-"} ms
              </td>

              <td>
                {new Date(
                  s.created_at
                ).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}