import Editor from "@monaco-editor/react";

export default function CodeEditor({
  problem,
  language,
  setLanguage,
  code,
  setCode,
  runCode,
  submitCode,
  running,
}) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          height: "50px",
          borderBottom: "1px solid #27272a",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 12px",
          background: "#18181b",
        }}
      >
        <select
          value={language}
          onChange={(e) => {
            const lang = e.target.value;

            setLanguage(lang);

            setCode(
              problem?.starter_code?.[lang] || ""
            );
          }}
        >
          <option value="python">
            Python
          </option>

          <option value="java">
            Java
          </option>
        </select>

        <div
          style={{
            display: "flex",
            gap: "10px",
          }}
        >
          <button
            onClick={runCode}
            disabled={running}
          >
            {running
              ? "Running..."
              : "Run"}
          </button>

          <button
            onClick={submitCode}
            disabled={running}
          >
            Submit
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
        }}
      >
        <Editor
          height="100%"
          language={language}
          value={code}
          theme="vs-dark"
          onChange={(value) =>
            setCode(value || "")
          }
          options={{
            minimap: {
              enabled: false,
            },
            fontSize: 14,
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  );
}