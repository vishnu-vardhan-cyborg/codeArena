import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Group, Panel, Separator } from "react-resizable-panels";
import { supabase } from "../../../shared/services/supabase";

import ProblemDescription from "../components/ProblemDescription";
import CodeEditor from "../components/CodeEditor";
import BottomPanel from "../components/BottomPanel";
import "../components/Problem.css";

export default function Problem() {
  const { problemId } = useParams();

  const [problem, setProblem] = useState(null);

  const [language, setLanguage] = useState("python");

  const [code, setCode] = useState("");

  const [submissionRefreshKey,
  setSubmissionRefreshKey] =
  useState(0);

  const [runResult, setRunResult] = useState(null);
  const [problemStatus,
  setProblemStatus] =
  useState(null);

  const [bottomTab, setBottomTab] = useState("testcases");

  const [running, setRunning] = useState(false);

  const loadProblemStatus = useCallback(async (currentProblemId) => {
    const user = JSON.parse(localStorage.getItem("loggedInUser") || "{}");

    if (!user.username) {
      setProblemStatus("NOT_STARTED");
      return;
    }

    const { data } = await supabase
      .from("user_problem_progress")
      .select("*")
      .eq("user_id", user.username)
      .eq("problem_id", currentProblemId)
      .maybeSingle();

    if (!data) {
      setProblemStatus("NOT_STARTED");
      return;
    }

    setProblemStatus(data.solved_at ? "SOLVED" : "ATTEMPTED");
  }, []);

  const loadDraft = useCallback(async (problemData, lang) => {
    const user = JSON.parse(localStorage.getItem("loggedInUser") || "{}");

    if (!user.username) {
      setCode(problemData.starter_code?.[lang] || "");
      return;
    }

    const { data } = await supabase
      .from("user_code_drafts")
      .select("code")
      .eq("user_id", user.username)
      .eq("problem_id", problemData.id)
      .eq("language", lang)
      .maybeSingle();

    setCode(data?.code || problemData.starter_code?.[lang] || "");
  }, []);

  const loadProblem = useCallback(async () => {
    const { data } = await supabase
      .from("problems")
      .select("*")
      .eq("id", problemId)
      .single();

    if (!data) return;

    setProblem(data);
    await loadDraft(data, "python");
    await loadProblemStatus(data.id);
  }, [loadDraft, loadProblemStatus, problemId]);

  useEffect(() => {
    loadProblem();
  }, [loadProblem]);

  async function updateUserProgress(
  userId,
  submissionId,
  result
) {
  const { data: existing } = await supabase
    .from("user_problem_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("problem_id", problem.id)
    .maybeSingle();

  if (!existing) {
    await supabase
      .from("user_problem_progress")
      .insert({
        user_id: userId,
        problem_id: problem.id,
        attempts: 1,
        solved_at:
          result.verdict === "ACCEPTED"
            ? new Date().toISOString()
            : null,
        best_runtime_ms:
          result.verdict === "ACCEPTED"
            ? result.execution_time_ms
            : null,
        xp_awarded:
          result.verdict === "ACCEPTED"
            ? problem.xp_reward
            : 0,
        last_submission_id: submissionId,
      });

    return;
  }

  const update = {
    attempts: existing.attempts + 1,
    last_submission_id: submissionId,
    updated_at: new Date().toISOString(),
  };

  if (result.verdict === "ACCEPTED") {
    if (!existing.solved_at) {
      update.solved_at =
        new Date().toISOString();

      update.xp_awarded =
        problem.xp_reward;
    }

    if (
      !existing.best_runtime_ms ||
      result.execution_time_ms <
        existing.best_runtime_ms
    ) {
      update.best_runtime_ms =
        result.execution_time_ms;
    }
  }

  await supabase
    .from("user_problem_progress")
    .update(update)
    .eq("user_id", userId)
    .eq("problem_id", problem.id);
}

  async function runCode() {
    setRunning(true);

    try {
      const payload = {
        language,

        function_name: problem.function_name,

        code,

        test_cases: problem.run_cases,
      };

      const response = await fetch("http://localhost:8000/judge/function", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      setRunResult(result);

      setBottomTab("result");
    } finally {
      setRunning(false);
    }
  }

async function submitCode() {
  setRunning(true);

  let submission = null;

  try {
    const user = JSON.parse(
      localStorage.getItem("loggedInUser")
    );

    // Create submission first
    const { data, error: insertError } = await supabase
      .from("problem_submissions")
      .insert({
        problem_id: problem.id,
        user_id: user.username,
        language,
        source_code: code,
        status: "PENDING",
      })
      .select()
      .single();

    if (insertError) throw insertError;
    

    submission = await data;



    const payload = {
      language,
      function_name: problem.function_name,
      code,
      test_cases: problem.judge_cases,
    };

    const response = await fetch(
      "http://localhost:8000/judge/function",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const result = await response.json();
        await updateUserProgress(
  user.username,
  submission.id,
  result
);
    

    await supabase
      .from("problem_submissions")
      .update({
        status: result.verdict,
        typhon_verdict: result.verdict,
        passed_tests: result.passed,
        total_tests: result.total,
        runtime_ms: result.execution_time_ms,
        stdout:
          result.results?.map(r => r.stdout).join("\n") || null,
        stderr: result.stderr || null,
        raw_result: result,
      })
      .eq("id", submission.id);
      setSubmissionRefreshKey(
  prev => prev + 1
);

    setRunResult(result);
    setBottomTab("result");
  } catch (error) {
    console.error(error);

    if (submission) {
      await supabase
        .from("problem_submissions")
        .update({
          status: "INTERNAL_ERROR",
          error_message:
            error?.message || "Unknown error",
        })
        .eq("id", submission.id);
    }
  } finally {
    setRunning(false);
  }
}

function resetCode(){
  setCode(problem.starter_code?.[language] || "");

}

  if (!problem) {
    return (
      <div className="problem-page problem-loading-state">
        Loading problem...
      </div>
    );
  }

  return (
    <div className="problem-page">
      <Group orientation="horizontal" className="problem-layout">
        <Panel defaultSize={45} minSize={32} className="problem-left-panel">
          <ProblemDescription
            problem={problem}
            problemStatus={problemStatus}
            submissionRefreshKey={submissionRefreshKey}
          />
        </Panel>

        <Separator className="problem-resize-handle horizontal" />

        <Panel defaultSize={55} minSize={38} className="problem-right-panel">
          <Group orientation="vertical" className="problem-editor-stack">
            <Panel defaultSize={72} minSize={45} className="problem-editor-panel">
              <CodeEditor
                problem={problem}
                language={language}
                setLanguage={setLanguage}
                code={code}
                setCode={setCode}
                resetCode={resetCode}
                runCode={runCode}
                submitCode={submitCode}
                running={running}
                loadDraft={loadDraft}
              />
            </Panel>

            <Separator className="problem-resize-handle vertical" />

            <Panel defaultSize={28} minSize={18} className="problem-output-panel">
              <BottomPanel
                problem={problem}
                runResult={runResult}
                bottomTab={bottomTab}
                setBottomTab={setBottomTab}
              />
            </Panel>
          </Group>
        </Panel>
      </Group>
    </div>
  );
}
