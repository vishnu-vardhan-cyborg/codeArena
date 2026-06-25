import { useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  ListChecks,
  Terminal,
  XCircle,
} from "lucide-react";
import TestCasesPanel from "./TestCasesPanel";

const bottomTabs = [
  { id: "testcases", label: "Testcases", icon: ListChecks },
  { id: "result", label: "Result", icon: Activity },
  { id: "console", label: "Console", icon: Terminal },
];

export default function BottomPanel({
  problem,
  runResult,
  bottomTab,
  setBottomTab,
}) {
  const [selectedCase, setSelectedCase] = useState(0);

  useEffect(() => {
    setSelectedCase(0);
  }, [runResult]);

  const selectedResult = runResult?.results?.[selectedCase];
  const verdictClass = runResult?.verdict
    ? runResult.verdict.toLowerCase().replace(/_/g, "-")
    : "";

  return (
    <section className="bottom-panel">
      <div className="bottom-tabs" role="tablist" aria-label="Output sections">
        {bottomTabs.map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            key={id}
            onClick={() => setBottomTab(id)}
            className={`bottom-tab ${bottomTab === id ? "active" : ""}`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      <div className="bottom-content">
        {bottomTab === "testcases" && (
          <TestCasesPanel testCases={problem.run_cases} />
        )}

        {bottomTab === "result" && (
          <>
            {!runResult ? (
              <div className="empty-panel-state">
                Run your code to see testcase results.
              </div>
            ) : (
              <div className="result-panel">
                <div className="result-header">
                  <span className={`verdict-badge ${verdictClass}`}>
                    {formatVerdict(runResult.verdict)}
                  </span>

                  <div className="result-summary-grid">
                    <div>
                      <span>Passed</span>
                      <strong>
                        {runResult.passed}/{runResult.total}
                      </strong>
                    </div>

                    <div>
                      <span>Runtime</span>
                      <strong>
                        {runResult.execution_time_ms?.toFixed(2) ?? "0.00"} ms
                      </strong>
                    </div>
                  </div>
                </div>

                {runResult.verdict === "COMPILATION_ERROR" && (
                  <ErrorBlock title="Compilation Error" message={runResult.stderr} />
                )}

                {runResult.verdict === "RUNTIME_ERROR" && (
                  <ErrorBlock title="Runtime Error" message={runResult.stderr} />
                )}

                {runResult.results?.length > 0 && (
                  <>
                    <div className="case-result-tabs">
                      {runResult.results.map((testcase, index) => (
                        <button
                          type="button"
                          key={index}
                          onClick={() => setSelectedCase(index)}
                          className={`case-result-tab ${
                            selectedCase === index ? "active" : ""
                          } ${testcase.passed ? "passed" : "failed"}`}
                        >
                          {testcase.passed ? (
                            <CheckCircle2 size={14} />
                          ) : (
                            <XCircle size={14} />
                          )}
                          Case {testcase.testcase_number}
                        </button>
                      ))}
                    </div>

                    {selectedResult && (
                      <div className="selected-result-card">
                        <div className="selected-result-meta">
                          <span>
                            Verdict
                            <strong>{formatVerdict(selectedResult.verdict)}</strong>
                          </span>

                          <span>
                            Hidden
                            <strong>{selectedResult.hidden ? "Yes" : "No"}</strong>
                          </span>
                        </div>

                        {!selectedResult.hidden && (
                          <div className="result-output-grid">
                            <OutputBlock
                              label="Expected"
                              value={selectedResult.expected_output}
                            />
                            <OutputBlock
                              label="Actual"
                              value={selectedResult.actual_output}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}

        {bottomTab === "console" && (
          <>
            {!runResult ? (
              <div className="empty-panel-state">
                Run your code to see console output.
              </div>
            ) : (
              <div className="console-panel">
                <OutputBlock
                  label="Stdout"
                  value={
                    runResult.results
                      ?.map((result) => result.stdout)
                      .filter(Boolean)
                      .join("\n") || "(empty)"
                  }
                />

                <OutputBlock
                  label="Stderr"
                  value={
                    runResult.stderr ||
                    runResult.results
                      ?.map((result) => result.stderr)
                      .filter(Boolean)
                      .join("\n") ||
                    "(empty)"
                  }
                />
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function ErrorBlock({ title, message }) {
  return (
    <div className="judge-error-block">
      <h3>{title}</h3>
      <pre>{message || "No error output was returned."}</pre>
    </div>
  );
}

function OutputBlock({ label, value }) {
  return (
    <div className="output-block">
      <span>{label}</span>
      <pre>{formatOutput(value)}</pre>
    </div>
  );
}

function formatVerdict(verdict = "") {
  return verdict.replace(/_/g, " ").toLowerCase();
}

function formatOutput(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}
