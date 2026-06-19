import TestCasesPanel from "./TestCasesPanel";
export default function BottomPanel({
  problem,
  runResult,
  bottomTab,
  setBottomTab,
}) {
  return (
    <div className="bottom-panel">
      <div className="bottom-tabs">
        {["testcases", "result", "console"].map((tab) => (
          <button
            key={tab}
            onClick={() => setBottomTab(tab)}
            className="
                px-4
                py-2
              ">
            {tab}
          </button>
        ))}
      </div>

      <div className="p-4">
        {bottomTab === "testcases" && (
          <TestCasesPanel testCases={problem.run_cases} />
        )}

        {bottomTab === "result" && runResult && (
          <div>
            <h3>{runResult.verdict}</h3>

            <p>
              Passed {runResult.passed}/{runResult.total}
            </p>

            {runResult.results?.map((tc) => (
              <div
                key={tc.testcase_number}
                className="
                      border
                      border-zinc-700
                      rounded
                      p-3
                      mt-3
                    ">
                <div>Case {tc.testcase_number}</div>

                <div>Expected: {tc.expected_output}</div>

                <div>Actual: {tc.actual_output}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
