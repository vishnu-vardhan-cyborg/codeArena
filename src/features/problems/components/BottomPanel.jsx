import { useState } from "react";
import TestCasesPanel from "./TestCasesPanel";

export default function BottomPanel({
  problem,
  runResult,
  bottomTab,
  setBottomTab,
}) {
  const [selectedCase, setSelectedCase] =
    useState(0);

  const verdictColors = {
    ACCEPTED: "#22c55e",
    WRONG_ANSWER: "#ef4444",
    RUNTIME_ERROR: "#f97316",
    COMPILATION_ERROR: "#f97316",
    TIME_LIMIT_EXCEEDED: "#eab308",
  };

  const selectedResult =
    runResult?.results?.[selectedCase];

  return (
    <div className="bottom-panel">
      <div className="bottom-tabs">
        {[
          "testcases",
          "result",
          "console",
        ].map((tab) => (
          <button
            key={tab}
            onClick={() =>
              setBottomTab(tab)
            }
            className="px-4 py-2"
            style={{
              opacity:
                bottomTab === tab
                  ? 1
                  : 0.6,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="p-4">
        {/* TEST CASES */}

        {bottomTab === "testcases" && (
          <TestCasesPanel
            testCases={
              problem.run_cases
            }
          />
        )}

        {/* RESULT */}

        {bottomTab === "result" && (
          <>
            {!runResult ? (
              <div
                style={{
                  color: "#a1a1aa",
                }}
              >
                Run your code to see
                results.
              </div>
            ) : (
              <div>
                <h3
                  style={{
                    color:
                      verdictColors[
                        runResult.verdict
                      ] || "#fff",
                    marginBottom:
                      "10px",
                  }}
                >
                  {
                    runResult.verdict
                  }
                </h3>

                <div
                  style={{
                    display: "flex",
                    gap: "20px",
                    marginBottom:
                      "16px",
                  }}
                >
                  <div>
                    Passed{" "}
                    {
                      runResult.passed
                    }
                    /
                    {
                      runResult.total
                    }
                  </div>

                  <div>
                    Runtime:{" "}
                    {runResult.execution_time_ms?.toFixed(
                      2
                    )}
                    ms
                  </div>
                </div>

                {/* Compilation Error */}

                {runResult.verdict ===
                  "COMPILATION_ERROR" && (
                  <div
                    className="
                      border
                      border-red-500
                      rounded
                      p-3
                    "
                  >
                    <h4>
                      Compilation
                      Error
                    </h4>

                    <pre>
                      {
                        runResult.stderr
                      }
                    </pre>
                  </div>
                )}

                {/* Runtime Error */}

                {runResult.verdict ===
                  "RUNTIME_ERROR" && (
                  <div
                    className="
                      border
                      border-orange-500
                      rounded
                      p-3
                    "
                  >
                    <h4>
                      Runtime Error
                    </h4>

                    <pre>
                      {
                        runResult.stderr
                      }
                    </pre>
                  </div>
                )}

                {/* Case Tabs */}

                {runResult.results
                  ?.length > 0 && (
                  <>
                    <div
                      style={{
                        display:
                          "flex",
                        gap: "8px",
                        marginTop:
                          "20px",
                        marginBottom:
                          "16px",
                        flexWrap:
                          "wrap",
                      }}
                    >
                      {runResult.results.map(
                        (
                          tc,
                          index
                        ) => (
                          <button
                            key={
                              index
                            }
                            onClick={() =>
                              setSelectedCase(
                                index
                              )
                            }
                            style={{
                              padding:
                                "6px 12px",
                              border:
                                selectedCase ===
                                index
                                  ? "1px solid #22c55e"
                                  : "1px solid #3f3f46",
                            }}
                          >
                            {tc.passed
                              ? "✓"
                              : "✗"}{" "}
                            Case{" "}
                            {tc.testcase_number}
                          </button>
                        )
                      )}
                    </div>

                    {/* Selected Case */}

                    {selectedResult && (
                      <div
                        className="
                          border
                          border-zinc-700
                          rounded
                          p-4
                        "
                      >
                        <div>
                          Verdict:{" "}
                          {
                            selectedResult.verdict
                          }
                        </div>

                        <div>
                          Hidden:{" "}
                          {selectedResult.hidden
                            ? "Yes"
                            : "No"}
                        </div>

                        {!selectedResult.hidden && (
                          <>
                            <div
                              style={{
                                marginTop:
                                  "10px",
                              }}
                            >
                              Expected:
                            </div>

                            <pre>
                              {String(
                                selectedResult.expected_output
                              )}
                            </pre>

                            <div>
                              Actual:
                            </div>

                            <pre>
                              {String(
                                selectedResult.actual_output
                              )}
                            </pre>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* CONSOLE */}

        {bottomTab === "console" && (
          <>
            {!runResult ? (
              <div
                style={{
                  color: "#a1a1aa",
                }}
              >
                Run your code to see
                console output.
              </div>
            ) : (
              <div>
                <h4>
                  Stdout
                </h4>

                <pre
                  className="
                    border
                    border-zinc-700
                    rounded
                    p-3
                    mb-4
                  "
                >
                  {runResult.results
                    ?.map(
                      (r) =>
                        r.stdout
                    )
                    .filter(Boolean)
                    .join("\n") ||
                    "(empty)"}
                </pre>

                <h4>
                  Stderr
                </h4>

                <pre
                  className="
                    border
                    border-zinc-700
                    rounded
                    p-3
                  "
                >
                  {runResult.stderr ||
                    runResult.results
                      ?.map(
                        (r) =>
                          r.stderr
                      )
                      .filter(
                        Boolean
                      )
                      .join(
                        "\n"
                      ) ||
                    "(empty)"}
                </pre>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}