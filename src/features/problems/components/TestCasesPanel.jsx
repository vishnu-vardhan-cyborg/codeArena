import { useState } from "react";

export default function TestCasesPanel({ testCases = [] }) {
  const [selected, setSelected] = useState(0);
  const current = testCases[selected];

  if (!testCases.length) {
    return (
      <div className="empty-panel-state">
        No sample testcases are available for this problem.
      </div>
    );
  }

  return (
    <div className="testcase-panel">
      <div className="testcase-tabs" role="tablist" aria-label="Sample testcases">
        {testCases.map((_, index) => (
          <button
            type="button"
            key={index}
            className={`testcase-tab ${selected === index ? "active" : ""}`}
            onClick={() => setSelected(index)}
          >
            Case {index + 1}
          </button>
        ))}
      </div>

      {current && (
        <div className="testcase-card">
          <div className="testcase-section">
            <div className="testcase-label">Input</div>

            {current.args?.map((arg, index) => (
              <div key={index} className="testcase-value">
                <span>{current.arg_types?.[index] || `arg${index + 1}`}</span>
                <code>{JSON.stringify(arg)}</code>
              </div>
            ))}
          </div>

          <div className="testcase-section">
            <div className="testcase-label">Expected Output</div>
            <div className="testcase-value single">
              <code>{JSON.stringify(current.expected_output)}</code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
