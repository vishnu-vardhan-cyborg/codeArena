import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getProblemById } from "../data/problems";
import { loadJudge0Languages, runJudge0Code } from "../judge0";

const starterCodeForLanguage = (languageName = "") => {
  const name = languageName.toLowerCase();

  if (name.includes("python")) {
    return 'name = input().strip()\nprint(f"Hello, {name}!")\n';
  }

  if (name.includes("javascript")) {
    return 'const fs = require("fs");\nconst input = fs.readFileSync(0, "utf8").trim();\nconsole.log("Hello, " + input + "!");\n';
  }

  if (name.includes("typescript")) {
    return 'const fs = require("fs");\nconst input: string = fs.readFileSync(0, "utf8").trim();\nconsole.log("Hello, " + input + "!");\n';
  }

  if (name.includes("java")) {
    return 'import java.util.Scanner;\n\nclass Main {\n  public static void main(String[] args) {\n    Scanner input = new Scanner(System.in);\n    System.out.println("Hello, " + input.nextLine() + "!");\n  }\n}\n';
  }

  if (name.includes("c++")) {
    return '#include <iostream>\n#include <string>\nusing namespace std;\n\nint main() {\n  string input;\n  getline(cin, input);\n  cout << "Hello, " << input << "!\\n";\n  return 0;\n}\n';
  }

  if (name.startsWith("c (")) {
    return '#include <stdio.h>\n\nint main(void) {\n  char input[100];\n  scanf("%99s", input);\n  printf("Hello, %s!\\n", input);\n  return 0;\n}\n';
  }

  return "";
};

const formatExecutionOutput = (result) => {
  const output =
    result.compile_output ||
    result.stderr ||
    result.stdout ||
    result.message ||
    "Program finished without output.";

  return String(output).trimEnd();
};

export default function Problem() {
  const navigate = useNavigate();
  const { problemId } = useParams();
  const problem = getProblemById(problemId);

  const [languages, setLanguages] = useState([]);
  const [languageId, setLanguageId] = useState("");
  const [sourceCode, setSourceCode] = useState("");
  const [stdin, setStdin] = useState("CodeArena");
  const [output, setOutput] = useState("Start Judge0, then run your code.");
  const [executionStatus, setExecutionStatus] = useState("Ready");
  const [isLoadingLanguages, setIsLoadingLanguages] = useState(true);
  const [isRunning, setIsRunning] = useState(false);

  const selectedLanguage = useMemo(
    () => languages.find((language) => String(language.id) === languageId),
    [languageId, languages]
  );

  useEffect(() => {
    const loadLanguages = async () => {
      setIsLoadingLanguages(true);

      try {
        const availableLanguages = await loadJudge0Languages();
        const defaultLanguage =
          availableLanguages.find((language) =>
            language.name.toLowerCase().includes("javascript")
          ) ||
          availableLanguages.find((language) =>
            language.name.toLowerCase().includes("python")
          ) ||
          availableLanguages[0];

        setLanguages(availableLanguages);

        if (defaultLanguage) {
          setLanguageId(String(defaultLanguage.id));
          setSourceCode(starterCodeForLanguage(defaultLanguage.name));
          setOutput("Judge0 is online. Run your code when ready.");
        } else {
          setOutput("Judge0 returned no active languages.");
        }
      } catch (error) {
        setExecutionStatus("Offline");
        setOutput(error.message);
      } finally {
        setIsLoadingLanguages(false);
      }
    };

    loadLanguages();
  }, []);

  const handleLanguageChange = (event) => {
    const nextLanguageId = event.target.value;
    const nextLanguage = languages.find(
      (language) => String(language.id) === nextLanguageId
    );

    setLanguageId(nextLanguageId);
    setSourceCode(starterCodeForLanguage(nextLanguage?.name));
    setOutput(`Switched to ${nextLanguage?.name || "language"}.`);
    setExecutionStatus("Ready");
  };

  const handleRunCode = async () => {
    if (!languageId || !sourceCode.trim()) {
      return;
    }

    setIsRunning(true);
    setExecutionStatus("Running");
    setOutput("Submitting code to Judge0...");

    try {
      const result = await runJudge0Code({
        languageId: Number(languageId),
        sourceCode,
        stdin,
      });

      setExecutionStatus(result.status?.description || "Finished");
      setOutput(formatExecutionOutput(result));
    } catch (error) {
      setExecutionStatus("Error");
      setOutput(error.message);
    } finally {
      setIsRunning(false);
    }
  };

  if (!problem) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Problem not found</h1>
          <button onClick={() => navigate("/home")}>Back</button>
        </div>
      </div>
    );
  }

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
          </div>
          <p>Acceptance: {problem.acceptance}</p>
        </div>

        <button onClick={() => navigate("/home")}>Back</button>
      </div>

      <div className="problem-workspace">
        <section className="problem-description">
          <h2>Description</h2>
          <p>{problem.description}</p>

          <h2>Examples</h2>
          {problem.examples.map((example, index) => (
            <div className="example-block" key={`${problem.id}-${index}`}>
              <strong>Example {index + 1}</strong>
              <pre>
                Input: {example.input}
                {"\n"}
                Output: {example.output}
              </pre>
            </div>
          ))}

          <h2>Constraints</h2>
          <ul>
            {problem.constraints.map((constraint) => (
              <li key={constraint}>{constraint}</li>
            ))}
          </ul>
        </section>

        <section className="code-runner-panel">
          <div className="code-runner-toolbar">
            <select
              value={languageId}
              disabled={isLoadingLanguages || languages.length === 0}
              onChange={handleLanguageChange}
              aria-label="Programming language"
            >
              {isLoadingLanguages && <option>Loading languages...</option>}
              {!isLoadingLanguages && languages.length === 0 && (
                <option>Judge0 offline</option>
              )}
              {languages.map((language) => (
                <option value={language.id} key={language.id}>
                  {language.name}
                </option>
              ))}
            </select>

            <button
              className={isRunning ? "btn disabled" : "btn"}
              disabled={isRunning || !selectedLanguage}
              onClick={handleRunCode}
            >
              {isRunning ? "Running..." : "Run Code"}
            </button>
          </div>

          <textarea
            className="code-editor"
            value={sourceCode}
            spellCheck="false"
            aria-label="Source code"
            onChange={(event) => setSourceCode(event.target.value)}
          />

          <div className="stdin-panel">
            <label htmlFor="stdin">Input</label>
            <textarea
              id="stdin"
              value={stdin}
              placeholder="Standard input"
              onChange={(event) => setStdin(event.target.value)}
            />
          </div>

          <div className="terminal-panel">
            <div className="terminal-header">
              <strong>Output</strong>
              <span>{executionStatus}</span>
            </div>
            <pre className="terminal-output">{output}</pre>
          </div>
        </section>
      </div>
    </div>
  );
}
