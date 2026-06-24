import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../shared/services/supabase";

export default function SubmissionDetails() {
  const { submissionId } = useParams();

  const [submission, setSubmission] =
    useState(null);

  useEffect(() => {
    loadSubmission();
  }, [submissionId]);

  async function loadSubmission() {
    const { data } = await supabase
      .from("problem_submissions")
      .select("*")
      .eq("id", submissionId)
      .single();

    setSubmission(data);
  }

  if (!submission) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-6">
      <h1>
        {submission.status}
      </h1>

      <p>
        Runtime:
        {" "}
        {submission.runtime_ms}
        ms
      </p>

      <p>
        Passed:
        {" "}
        {submission.passed_tests}
        /
        {submission.total_tests}
      </p>

      <h3>Code</h3>

      <pre
        style={{
          overflow: "auto",
        }}
      >
        {submission.source_code}
      </pre>

      <h3>Test Results</h3>

      {submission.raw_result?.results?.map(
        (tc) => (
          <div
            key={
              tc.testcase_number
            }
            style={{
              border:
                "1px solid #333",
              padding: "12px",
              marginTop: "10px",
            }}
          >
            <div>
              Case {
                tc.testcase_number
              }
            </div>

            <div>
              Verdict:
              {" "}
              {tc.verdict}
            </div>

            <div>
              Expected:
              {" "}
              {
                tc.expected_output
              }
            </div>

            <div>
              Actual:
              {" "}
              {tc.actual_output}
            </div>

            {tc.stdout && (
              <pre>
                {tc.stdout}
              </pre>
            )}

            {tc.stderr && (
              <pre>
                {tc.stderr}
              </pre>
            )}
          </div>
        )
      )}
    </div>
  );
}