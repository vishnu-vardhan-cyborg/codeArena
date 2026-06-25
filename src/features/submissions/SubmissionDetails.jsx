import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Code2,
  FileText,
  FlaskConical,
  Timer,
} from "lucide-react";
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

const getResultRows = (rawResult) => {
  if (!rawResult) return [];

  if (Array.isArray(rawResult.results)) {
    return rawResult.results;
  }

  if (typeof rawResult === "string") {
    try {
      const parsedResult = JSON.parse(rawResult);
      return Array.isArray(parsedResult.results) ? parsedResult.results : [];
    } catch {
      return [];
    }
  }

  return [];
};

export default function SubmissionDetails() {
  const { submissionId } = useParams();
  const navigate = useNavigate();

  const [submission, setSubmission] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSubmission = useCallback(async () => {
    setIsLoading(true);
    setError("");

    const { data, error: submissionError } = await supabase
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
      .eq("id", submissionId)
      .single();

    if (submissionError) {
      setError(submissionError.message);
      setSubmission(null);
    } else {
      setSubmission(data);
    }

    setIsLoading(false);
  }, [submissionId]);

  useEffect(() => {
    loadSubmission();
  }, [loadSubmission]);

  const resultRows = useMemo(
    () => getResultRows(submission?.raw_result),
    [submission?.raw_result]
  );

  if (isLoading) {
    return (
      <main className="submissions-page submissions-loading">
        Loading submission...
      </main>
    );
  }

  if (error || !submission) {
    return (
      <main className="submissions-page">
        <section className="submissions-panel">
          <p className="submissions-state error">
            {error || "Submission not found."}
          </p>
          <button
            type="button"
            className="submissions-back-button"
            onClick={() => navigate("/submissions")}
          >
            Back to submissions
          </button>
        </section>
      </main>
    );
  }

  const statusClass = getStatusClass(submission.status);

  return (
    <main className="submissions-page submission-detail-page">
      <header className="submissions-header submission-detail-header">
        <div>
          <span className="submissions-eyebrow">
            <FileText size={16} />
            Submission detail
          </span>
          <h1>{formatStatus(submission.status)}</h1>
          <p>
            {submission.problems?.title || "Untitled problem"} -{" "}
            {submission.problems?.difficulty || "Difficulty not set"}
          </p>
        </div>

        <button
          type="button"
          className="submissions-back-button"
          onClick={() => navigate("/submissions")}
        >
          <ArrowLeft size={15} />
          Back
        </button>
      </header>

      <section className="submission-detail-metrics">
        <article>
          <CheckCircle2 size={18} />
          <span>Verdict</span>
          <strong className={`submission-verdict ${statusClass}`}>
            {formatStatus(submission.status)}
          </strong>
        </article>
        <article>
          <Timer size={18} />
          <span>Runtime</span>
          <strong>{submission.runtime_ms ?? "-"} ms</strong>
        </article>
        <article>
          <FlaskConical size={18} />
          <span>Passed</span>
          <strong>
            {submission.passed_tests ?? 0}/{submission.total_tests ?? 0}
          </strong>
        </article>
        <article>
          <Code2 size={18} />
          <span>Language</span>
          <strong>{submission.language || "-"}</strong>
          <small>{formatSubmittedAt(submission.created_at)}</small>
        </article>
      </section>

      <section className="submission-detail-panel">
        <div className="submissions-panel-heading">
          <div>
            <span className="submissions-eyebrow">Source</span>
            <h2>Code</h2>
          </div>
        </div>
        <pre className="submission-code-block">
          <code>{submission.source_code || "// No source code saved."}</code>
        </pre>
      </section>

      <section className="submission-detail-panel">
        <div className="submissions-panel-heading">
          <div>
            <span className="submissions-eyebrow">Judge output</span>
            <h2>Test Results</h2>
          </div>
        </div>

        {resultRows.length === 0 ? (
          <p className="submissions-state">No testcase details saved.</p>
        ) : (
          <div className="submission-test-list">
            {resultRows.map((testcase, index) => {
              const testcaseVerdict = testcase.verdict || submission.status;
              return (
                <article
                  className="submission-test-card"
                  key={testcase.testcase_number || index}
                >
                  <div className="submission-test-heading">
                    <strong>Case {testcase.testcase_number || index + 1}</strong>
                    <span
                      className={`submission-verdict ${getStatusClass(
                        testcaseVerdict
                      )}`}
                    >
                      {formatStatus(testcaseVerdict)}
                    </span>
                  </div>

                  <div className="submission-test-grid">
                    <div>
                      <span>Expected</span>
                      <pre>{testcase.expected_output ?? "-"}</pre>
                    </div>
                    <div>
                      <span>Actual</span>
                      <pre>{testcase.actual_output ?? "-"}</pre>
                    </div>
                  </div>

                  {(testcase.stdout || testcase.stderr) && (
                    <div className="submission-test-console">
                      {testcase.stdout && (
                        <div>
                          <span>Stdout</span>
                          <pre>{testcase.stdout}</pre>
                        </div>
                      )}
                      {testcase.stderr && (
                        <div>
                          <span>Stderr</span>
                          <pre>{testcase.stderr}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
