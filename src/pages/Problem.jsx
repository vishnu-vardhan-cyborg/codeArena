import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Group, Panel, Separator } from "react-resizable-panels";
import { supabase } from "../supabase";

import ProblemDescription from "../components/problem/ProblemDescription";
import CodeEditor from "../components/problem/CodeEditor";
import BottomPanel from "../components/problem/BottomPanel";
import "../components/problem/Problem.css";

export default function Problem() {
  const { problemId } = useParams();

  const [problem, setProblem] = useState(null);

  const [language, setLanguage] = useState("python");

  const [code, setCode] = useState("");

  const [runResult, setRunResult] = useState(null);

  const [bottomTab, setBottomTab] = useState("testcases");

  const [running, setRunning] = useState(false);

  useEffect(() => {
    loadProblem();
  }, [problemId]);

  async function loadProblem() {
    const { data } = await supabase
      .from("problems")
      .select("*")
      .eq("id", problemId)
      .single();

    setProblem(data);

    setCode(data.starter_code.python);
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

    try {
      const payload = {
        language,

        function_name: problem.function_name,

        code,

        test_cases: problem.judge_cases,
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

  if (!problem) return <div>Loading...</div>;

  return (
    <div
      className="problem-page"
      style={{
        height: "100vh",
      }}>
      <Group orientation="horizontal">
        <Panel defaultSize={45}>
          <ProblemDescription problem={problem} />
        </Panel>

        <Separator />

        <Panel defaultSize={55}>
          <Group orientation="vertical">
            <Panel defaultSize={72}>
              <div style={{ height: "100%" }}>
                <CodeEditor
                  problem={problem}
                  language={language}
                  setLanguage={setLanguage}
                  code={code}
                  setCode={setCode}
                  runCode={runCode}
                  submitCode={submitCode}
                  running={running}
                />
              </div>
            </Panel>

            <Separator />

            <Panel defaultSize={28}>
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
