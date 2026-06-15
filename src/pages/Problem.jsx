import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CheckCircle2,
  Clock3,
  Play,
  Send,
  ShieldCheck,
  Trophy,
  XCircle,
  Zap,
} from "lucide-react";
import {
  loadProblem,
  loadTyphonLanguages,
  runTyphonCode,
  submitProblem,
} from "../features/problems/problemApi";

const formatExecutionOutput = (result) => {
  const output =
    result.stderr ||
    result.stdout ||
    (result.timed_out ? "Execution timed out." : "") ||
    "Program finished without output.";

  return String(output).trimEnd();
};

export default function Problem() {
  const navigate = useNavigate();
  const { problemId } = useParams();
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("loggedInUser") || "null");
    } catch {
      return null;
    }
  }, []);

  const [problem, setProblem] = useState(null);
  const [languages, setLanguages] = useState([]);
  const [languageId, setLanguageId] = useState("");
  const [sourceCode, setSourceCode] = useState("");
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState("Typhon terminal ready.");
  const [executionStatus, setExecutionStatus] = useState("Ready");
  const [submissionResult, setSubmissionResult] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedLanguage = useMemo(
    () => languages.find((language) => String(language.id) === languageId),
    [languageId, languages]
  );

  useEffect(() => {
    let active = true;

    Promise.all([
      loadProblem(problemId, currentUser?.id),
      loadTyphonLanguages(),
    ])
      .then(([loadedProblem, availableLanguages]) => {
        if (!active) return;

        const defaultLanguage =
          availableLanguages.find((language) => language.id === "python") ||
          availableLanguages[0];

        setProblem(loadedProblem);
        setLanguages(availableLanguages);
        setStdin(loadedProblem.examples?.[0]?.input || "");

        if (defaultLanguage) {
          setLanguageId(String(defaultLanguage.id));
          setSourceCode(loadedProblem.starter_code?.[defaultLanguage.id] || "");
        }
      })
      .catch((error) => {
        if (active) setLoadError(error.message);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentUser?.id, problemId]);

  const handleLanguageChange = (event) => {
    const nextLanguageId = event.target.value;
    setLanguageId(nextLanguageId);
    setSourceCode(problem?.starter_code?.[nextLanguageId] || "");
    setOutput(`Switched to ${nextLanguageId}.`);
    setExecutionStatus("Ready");
    setSubmissionResult(null);
  };

  const handleRunCode = async () => {
    if (!languageId || !sourceCode.trim()) return;

    setIsRunning(true);
    setExecutionStatus("Running");
    setOutput("Executing custom input with Typhon...");

    try {
      const result = await runTyphonCode({
        language: languageId,
        sourceCode,
        stdin,
      });

      setExecutionStatus(
        result.timed_out
          ? "Time Limit Exceeded"
          : Number(result.exit_code) === 0
            ? "Finished"
            : "Runtime Error"
      );
      setOutput(formatExecutionOutput(result));
    } catch (error) {
      setExecutionStatus("Error");
      setOutput(error.message);
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!currentUser?.id || !languageId || !sourceCode.trim()) return;

    setIsSubmitting(true);
    setSubmissionResult(null);
    setExecutionStatus("Judging");
    setOutput("Running hidden test cases. Run inputs are not stored...");

    try {
      const result = await submitProblem(problemId, {
        userId: currentUser.id,
        language: languageId,
        sourceCode,
      });

      setSubmissionResult(result);
      setExecutionStatus(result.status);
      setOutput(
        result.status === "Accepted"
          ? `Accepted. Passed ${result.passedTests}/${result.totalTests} hidden and public tests.`
          : `${result.status}. Passed ${result.passedTests}/${result.totalTests} tests.\n${result.errorMessage || ""}`.trim()
      );

      setProblem((currentProblem) => ({
        ...currentProblem,
        acceptance: result.acceptance,
        solved: result.solved,
        attempts: result.attempts,
        bestRuntimeMs: result.bestRuntimeMs,
      }));

      if (result.totalXp !== undefined) {
        localStorage.setItem(
          "loggedInUser",
          JSON.stringify({ ...currentUser, xp: result.totalXp })
        );
      }
    } catch (error) {
      setExecutionStatus("Error");
      setOutput(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <p className="page problem-loading">Loading challenge...</p>;
  }

  if (!problem || loadError) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h1>Problem unavailable</h1>
            <p>{loadError || "Problem not found."}</p>
          </div>
          <button onClick={() => navigate("/home")}>Back</button>
        </div>
      </div>
    );
  }

  const busy = isRunning || isSubmitting;

  return (
    <div className="page problem-page">
      <div className="page-header">
        <div>
          <div className="problem-title-row">
            <h1>{problem.title}</h1>
            <span
              className={`difficulty-badge ${problem.difficulty.toLowerCase()}`}
            >
              {problem.difficulty}
            </span>
            {problem.solved && (
              <span className="problem-solved-label">
                <CheckCircle2 size={15} />
                Solved
              </span>
            )}
          </div>
          <p>
            Acceptance: {problem.acceptance} · Reward: {problem.xp_reward} XP ·
            Attempts: {problem.attempts}
          </p>
        </div>

        <button onClick={() => navigate("/home")}>Back</button>
      </div>

      <div className="problem-workspace">
        <section className="problem-description">
          <h2>Description</h2>
          <p>{problem.description}</p>

          <h2>Input format</h2>
          <p>{problem.input_format}</p>

          <h2>Output format</h2>
          <p>{problem.output_format}</p>

          <h2>Examples</h2>
          {(problem.examples || []).map((example, index) => (
            <div className="example-block" key={`${problem.id}-${index}`}>
              <strong>Example {index + 1}</strong>
              <pre>
                Input:
                {"\n"}
                {example.input}
                {"\n\n"}
                Output:
                {"\n"}
                {example.output}
              </pre>
            </div>
          ))}

          <h2>Constraints</h2>
          <ul>
            {(problem.constraints || []).map((constraint) => (
              <li key={constraint}>{constraint}</li>
            ))}
          </ul>

          <div className="problem-target-complexity">
            <div>
              <Clock3 size={16} />
              <span>
                Expected time
                <strong>{problem.expected_time_complexity}</strong>
              </span>
            </div>
            <div>
              <Zap size={16} />
              <span>
                Expected space
                <strong>{problem.expected_space_complexity}</strong>
              </span>
            </div>
          </div>
        </section>

        <section className="code-runner-panel">
          <div className="code-runner-toolbar">
            <select
              value={languageId}
              disabled={busy || languages.length === 0}
              onChange={handleLanguageChange}
              aria-label="Programming language"
            >
              {languages.length === 0 && <option>Typhon offline</option>}
              {languages.map((language) => (
                <option value={language.id} key={language.id}>
                  {language.name}
                </option>
              ))}
            </select>

            <div className="problem-run-actions">
              <button
                className="btn secondary-run"
                disabled={busy || !selectedLanguage}
                onClick={handleRunCode}
              >
                <Play size={15} />
                {isRunning ? "Running..." : "Run"}
              </button>
              <button
                className="btn submit-code"
                disabled={busy || !selectedLanguage}
                onClick={handleSubmit}
              >
                <Send size={15} />
                {isSubmitting ? "Judging..." : "Submit"}
              </button>
            </div>
          </div>

          <textarea
            className="code-editor"
            value={sourceCode}
            spellCheck="false"
            aria-label="Source code"
            onChange={(event) => setSourceCode(event.target.value)}
          />

          <div className="stdin-panel">
            <label htmlFor="stdin">
              Custom input
              <small>Runs are temporary and are not stored.</small>
            </label>
            <textarea
              id="stdin"
              value={stdin}
              placeholder="Standard input"
              onChange={(event) => setStdin(event.target.value)}
            />
          </div>

          <div className="terminal-panel">
            <div className="terminal-header">
              <strong>Typhon Terminal</strong>
              <span>{executionStatus}</span>
            </div>
            <pre className="terminal-output">{output}</pre>
          </div>
        </section>
      </div>

      {submissionResult && (
        <section
          className={`submission-report ${
            submissionResult.status === "Accepted" ? "accepted" : "rejected"
          }`}
        >
          <div className="submission-report-heading">
            {submissionResult.status === "Accepted" ? (
              <ShieldCheck size={24} />
            ) : (
              <XCircle size={24} />
            )}
            <div>
              <span>Submission verdict</span>
              <h2>{submissionResult.status}</h2>
            </div>
            {submissionResult.xpAwarded > 0 && (
              <strong>
                <Trophy size={15} />+{submissionResult.xpAwarded} XP
              </strong>
            )}
          </div>

          <div className="submission-metrics">
            <article>
              <span>Tests passed</span>
              <strong>
                {submissionResult.passedTests}/{submissionResult.totalTests}
              </strong>
            </article>
            <article>
              <span>Average runtime</span>
              <strong>{submissionResult.runtimeMs} ms</strong>
            </article>
            <article>
              <span>Acceptance rate</span>
              <strong>{submissionResult.acceptance}</strong>
            </article>
            <article>
              <span>Best runtime</span>
              <strong>{submissionResult.bestRuntimeMs ?? "N/A"} ms</strong>
            </article>
          </div>

          <div className="submission-complexity">
            <div>
              <span>Expected complexity</span>
              <strong>
                Time {submissionResult.expectedComplexity.time} · Space{" "}
                {submissionResult.expectedComplexity.space}
              </strong>
            </div>
            <div>
              <span>Static source estimate</span>
              <strong>
                Time {submissionResult.estimatedComplexity.time} · Space{" "}
                {submissionResult.estimatedComplexity.space}
              </strong>
              <small>
                This estimate is heuristic. Passing hidden tests determines
                correctness.
              </small>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
