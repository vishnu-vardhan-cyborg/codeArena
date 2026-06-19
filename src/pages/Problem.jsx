import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  BookOpen,
  CheckCircle2,
  Clock3,
  FileText,
  History,
  Hourglass,
  NotebookPen,
  Pause,
  Play,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  Trophy,
  XCircle,
  Zap,
} from "lucide-react";
import {
  loadProblem,
  loadProblemEditorial,
  loadProblemNote,
  loadProblemSubmissions,
  loadTyphonLanguages,
  runTyphonCode,
  saveProblemNote,
  submitProblem,
} from "../features/problems/problemApi";
import {
  applyHuntReward,
  completeCapsuleAttackDefense,
} from "../features/powerups/powerupApi";
import { showAppToast } from "../utils/appToast";

const studyTabs = [
  { id: "notes", label: "Notes", icon: NotebookPen },
  { id: "submissions", label: "Submissions", icon: History },
  { id: "last", label: "Last submission", icon: FileText },
  { id: "editorial", label: "Editorial", icon: BookOpen },
];

const HUNT_POWERUP_LABELS = {
  settle_the_bet: "Settle the Bet",
  steal: "Steal XP",
  shield: "Shield",
  uno_reverse: "Uno Reverse",
  streak_recover: "Streak Recover",
};

const formatExecutionOutput = (result) => {
  const output =
    result.stderr ||
    result.stdout ||
    (result.timed_out ? "Execution timed out." : "") ||
    "Program finished without output.";

  return String(output).trimEnd();
};

const formatSubmissionDate = (value) => {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const getSubmissionTone = (status = "") =>
  status === "Accepted" ? "accepted" : "rejected";

const formatSolveTimer = (seconds) => {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  return [hours, minutes, remainingSeconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
};

export default function Problem() {
  const { problemId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const attackId = searchParams.get("attackId");
  const attackCapsuleId = searchParams.get("capsuleId");
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
  const [activeStudyTab, setActiveStudyTab] = useState("notes");
  const [editorial, setEditorial] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [latestSubmission, setLatestSubmission] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteStatus, setNoteStatus] = useState("");
  const [extrasLoading, setExtrasLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [solveSeconds, setSolveSeconds] = useState(0);
  const [solveTimerRunning, setSolveTimerRunning] = useState(false);

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

  useEffect(() => {
    setSolveSeconds(0);
    setSolveTimerRunning(false);
  }, [problemId]);

  useEffect(() => {
    if (!solveTimerRunning) return undefined;

    const timerId = window.setInterval(() => {
      setSolveSeconds((seconds) => seconds + 1);
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [solveTimerRunning]);

  useEffect(() => {
    let active = true;

    setExtrasLoading(true);
    setEditorial(null);
    setSubmissions([]);
    setLatestSubmission(null);
    setNoteDraft("");
    setNoteStatus("");

    Promise.all([
      loadProblemEditorial(problemId),
      loadProblemSubmissions(problemId, currentUser?.id),
      loadProblemNote(problemId, currentUser?.id),
    ])
      .then(([editorialData, submissionData, noteData]) => {
        if (!active) return;

        setEditorial(editorialData);
        setSubmissions(submissionData.submissions || []);
        setLatestSubmission(submissionData.latestSubmission || null);
        setNoteDraft(noteData?.body || "");
      })
      .finally(() => {
        if (active) setExtrasLoading(false);
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

      if (result.status === "Accepted") {
        setSolveTimerRunning(false);
      }

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

      if (result.status === "Accepted" && currentUser?.id && attackId) {
        try {
          const defenseResult = await completeCapsuleAttackDefense({
            userId: currentUser.id,
            attackId,
            problemId,
          });

          showAppToast(
            defenseResult.message || "Defense completed. Attack cleared.",
            "success"
          );

          if (attackCapsuleId) {
            window.setTimeout(() => {
              navigate(`/time-capsules/${attackCapsuleId}`);
            }, 900);
          }
        } catch (error) {
          showAppToast(error.message, "error");
        }
      }

      if (result.status === "Accepted" && currentUser?.id) {
        const chestKey = `codeArenaLockedChest:${currentUser.id}`;
        const rewardKey = `codeArenaChestReward:${currentUser.id}`;

        try {
          const pendingChest = JSON.parse(
            localStorage.getItem(chestKey) || "null"
          );

          if (
            pendingChest?.problemId &&
            pendingChest?.powerupType &&
            String(pendingChest.problemId) === String(problemId)
          ) {
            const rewardResult = await applyHuntReward({
              userId: currentUser.id,
              rewardKind: "powerup",
              powerupName: pendingChest.powerupType,
              metadata: {
                source: "chest",
                problemId,
                position: pendingChest.position || null,
                unlockedByProblem: true,
              },
            });

            if (!rewardResult?.inventory) {
              throw new Error("Powerup could not be added. Please try again.");
            }

            const powerupLabel =
              HUNT_POWERUP_LABELS[pendingChest.powerupType] || "Powerup";
            localStorage.removeItem(chestKey);
            localStorage.setItem(
              rewardKey,
              JSON.stringify({
                powerupName: pendingChest.powerupType,
                label: powerupLabel,
                createdAt: new Date().toISOString(),
              })
            );
            showAppToast(
              `${powerupLabel} added to inventory!`,
              "success",
              "Powerup added"
            );
            window.setTimeout(() => {
              navigate("/power-up-hunt");
            }, 900);
          }
        } catch (error) {
          showAppToast(
            error.message || "Powerup could not be added. Please try again.",
            "error"
          );
        }
      }

      const submissionData = await loadProblemSubmissions(
        problemId,
        currentUser.id
      );
      setSubmissions(submissionData.submissions || []);
      setLatestSubmission(submissionData.latestSubmission || null);
    } catch (error) {
      setExecutionStatus("Error");
      setOutput(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveNote = async () => {
    if (!currentUser?.id) {
      setNoteStatus("Sign in to save notes.");
      return;
    }

    setNoteStatus("Saving...");

    try {
      const note = await saveProblemNote(problemId, {
        userId: currentUser.id,
        body: noteDraft,
      });
      setNoteDraft(note?.body || "");
      setNoteStatus("Saved.");
    } catch (error) {
      setNoteStatus(error.message);
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
        </div>
      </div>
    );
  }

  const busy = isRunning || isSubmitting;
  const problemTopics = Array.isArray(problem.topics) ? problem.topics : [];
  const editorialTopics =
    Array.isArray(editorial?.topics) && editorial.topics.length > 0
      ? editorial.topics
      : problemTopics;
  const displayedLatestSubmission = latestSubmission || submissions[0] || null;
  const solveTimerLabel = formatSolveTimer(solveSeconds);

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
          {problemTopics.length > 0 && (
            <div className="problem-topic-strip problem-topic-strip-large">
              {problemTopics.map((topic) => (
                <small key={topic}>{topic}</small>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="problem-workspace">
        <section className="problem-description">
          <div className="problem-description-heading">
            <h2>Description</h2>
            <div className="problem-solve-timer" aria-label="Problem timer">
              <Hourglass size={16} />
              <strong>{solveTimerLabel}</strong>
              <button
                className="timer-primary"
                type="button"
                onClick={() => setSolveTimerRunning((running) => !running)}
              >
                {solveTimerRunning ? <Pause size={14} /> : <Play size={14} />}
                {solveTimerRunning
                  ? "Pause"
                  : solveSeconds > 0
                    ? "Resume"
                    : "Start"}
              </button>
              {solveSeconds > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSolveSeconds(0);
                    setSolveTimerRunning(false);
                  }}
                >
                  <RotateCcw size={14} />
                  Reset
                </button>
              )}
            </div>
          </div>
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

      <section className="problem-study-panel">
        <div className="problem-study-heading">
          <div>
            <span>Study console</span>
            <h2>Notes, submissions, and editorial</h2>
          </div>
          {extrasLoading && (
            <strong className="problem-study-loading">Loading...</strong>
          )}
        </div>

        <nav className="problem-study-tabs" aria-label="Problem study tabs">
          {studyTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                className={activeStudyTab === tab.id ? "active-study-tab" : ""}
                type="button"
                key={tab.id}
                onClick={() => setActiveStudyTab(tab.id)}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="problem-study-content">
          {activeStudyTab === "notes" && (
            <div className="problem-notes-panel">
              <label htmlFor="problem-note">
                Personal notes
                <small>
                  Stored per user and problem. Use this for patterns, edge
                  cases, and mistakes.
                </small>
              </label>
              <textarea
                id="problem-note"
                value={noteDraft}
                placeholder="Write your observations, failed ideas, or final pattern here."
                onChange={(event) => {
                  setNoteDraft(event.target.value);
                  setNoteStatus("");
                }}
              />
              <div className="problem-note-actions">
                <button type="button" onClick={handleSaveNote}>
                  <Save size={15} />
                  Save notes
                </button>
                {noteStatus && <span>{noteStatus}</span>}
              </div>
            </div>
          )}

          {activeStudyTab === "submissions" && (
            <div className="submission-history-list">
              {submissions.length === 0 ? (
                <p className="problem-study-empty">
                  No submissions yet. Submit code once to create history.
                </p>
              ) : (
                submissions.map((submission) => (
                  <article
                    className={`submission-history-card ${getSubmissionTone(
                      submission.status
                    )}`}
                    key={submission.id}
                  >
                    <div>
                      <strong>{submission.status}</strong>
                      <span>{formatSubmissionDate(submission.created_at)}</span>
                    </div>
                    <div>
                      <span>Language</span>
                      <strong>{submission.language}</strong>
                    </div>
                    <div>
                      <span>Tests</span>
                      <strong>
                        {submission.passed_tests}/{submission.total_tests}
                      </strong>
                    </div>
                    <div>
                      <span>Runtime</span>
                      <strong>{submission.runtime_ms ?? "N/A"} ms</strong>
                    </div>
                  </article>
                ))
              )}
            </div>
          )}

          {activeStudyTab === "last" && (
            <div className="last-submission-panel">
              {!displayedLatestSubmission ? (
                <p className="problem-study-empty">
                  No last submission yet. Your most recent submitted code will
                  appear here.
                </p>
              ) : (
                <>
                  <div className="last-submission-summary">
                    <article
                      className={getSubmissionTone(
                        displayedLatestSubmission.status
                      )}
                    >
                      <span>Status</span>
                      <strong>{displayedLatestSubmission.status}</strong>
                    </article>
                    <article>
                      <span>Submitted</span>
                      <strong>
                        {formatSubmissionDate(
                          displayedLatestSubmission.created_at
                        )}
                      </strong>
                    </article>
                    <article>
                      <span>Complexity estimate</span>
                      <strong>
                        {displayedLatestSubmission.estimated_time_complexity ||
                          "N/A"}{" "}
                        /{" "}
                        {displayedLatestSubmission.estimated_space_complexity ||
                          "N/A"}
                      </strong>
                    </article>
                  </div>
                  {displayedLatestSubmission.error_message && (
                    <pre className="last-submission-error">
                      {displayedLatestSubmission.error_message}
                    </pre>
                  )}
                  <pre className="last-submission-code">
                    {displayedLatestSubmission.source_code}
                  </pre>
                </>
              )}
            </div>
          )}

          {activeStudyTab === "editorial" && (
            <div className="problem-editorial-panel">
              {!editorial && editorialTopics.length === 0 ? (
                <p className="problem-study-empty">
                  No editorial has been added for this problem yet.
                </p>
              ) : (
                <>
                  {editorialTopics.length > 0 && (
                    <div className="problem-editorial-topics">
                      {editorialTopics.map((topic) => (
                        <small key={topic}>{topic}</small>
                      ))}
                    </div>
                  )}
                  <article>
                    <span>Overview</span>
                    <p>{editorial?.overview || "Study the target pattern and map the input to the expected output carefully."}</p>
                  </article>
                  <article>
                    <span>Approach</span>
                    <p>{editorial?.approach || "Use the listed topics to choose the correct data structure, then verify edge cases against the examples."}</p>
                  </article>
                  {editorial?.complexity_notes && (
                    <article>
                      <span>Complexity</span>
                      <p>{editorial.complexity_notes}</p>
                    </article>
                  )}
                  <div className="editorial-solution-grid">
                    <div>
                      <strong>Python solution notes</strong>
                      <pre>
                        {editorial?.solution_python ||
                          "Implement solve(data), parse stdin, apply the approach, and return the exact output format."}
                      </pre>
                    </div>
                    <div>
                      <strong>Java solution notes</strong>
                      <pre>
                        {editorial?.solution_java ||
                          "Implement solve(input), parse stdin, apply the approach, and print the exact output format."}
                      </pre>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
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
