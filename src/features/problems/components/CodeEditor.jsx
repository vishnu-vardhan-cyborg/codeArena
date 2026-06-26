import Editor from "@monaco-editor/react";
import { useEffect } from "react";
import { Play, RotateCcw, Send } from "lucide-react";
import { supabase } from "../../../shared/services/supabase";

export default function CodeEditor({
  problem,
  language,
  setLanguage,
  code,
  setCode,
  resetCode,
  runCode,
  submitCode,
  running,
  loadDraft,
}) {
  useEffect(() => {
    if (!problem) return;

    const user = JSON.parse(localStorage.getItem("loggedInUser") || "{}");

    if (!user.username) return;

    const timer = setTimeout(async () => {
      await supabase.from("user_code_drafts").upsert({
        user_id: user.username,
        problem_id: problem.id,
        language,
        code,
        updated_at: new Date().toISOString(),
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [code, language, problem]);

  async function handleLanguageChange(event) {
    const lang = event.target.value;

    setLanguage(lang);
    await loadDraft(problem, lang);
  }

  return (
    <section className="code-editor-shell">
      <header className="editor-toolbar">
        <label className="language-picker">
          <span>Language</span>
          <select
            className="language-select"
            value={language}
            onChange={handleLanguageChange}
          >
            <option value="python">Python</option>
            <option value="java">Java</option>
          </select>
        </label>

        <div className="editor-actions">
          <button
            type="button"
            className="editor-action-button run-btn"
            onClick={runCode}
            disabled={running}
          >
            <Play size={16} />
            {running ? "Running" : "Run"}
          </button>

          <button
            type="button"
            className="editor-action-button reset-btn"
            onClick={resetCode}
          >
            <RotateCcw size={16} />
            Reset
          </button>

          <button
            type="button"
            className="editor-action-button submit-btn"
            onClick={submitCode}
            disabled={running}
          >
            <Send size={16} />
            Submit
          </button>
        </div>
      </header>

      <div className="monaco-editor-frame">
        <Editor
          height="100%"
          language={language}
          value={code}
          theme="vs-dark"
          onChange={(value) => setCode(value || "")}
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
    </section>
  );
}
