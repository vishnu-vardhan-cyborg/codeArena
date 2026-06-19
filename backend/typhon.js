const TYPHON_URL = String(
  process.env.TYPHON_URL || "http://localhost:8000"
).replace(/\/+$/, "");

const MAX_SOURCE_LENGTH = 50000;
const MAX_STDIN_LENGTH = 20000;

const fetchWithTimeout = async (url, options = {}, timeoutMs = 12000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
};

const parseResponse = async (response) => {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
};

const requestTyphon = async (path, options = {}, timeoutMs) => {
  try {
    const response = await fetchWithTimeout(
      `${TYPHON_URL}${path}`,
      options,
      timeoutMs
    );
    const data = await parseResponse(response);

    if (!response.ok) {
      const error = new Error(
        data.detail || data.error || `Typhon request failed (${response.status})`
      );
      error.statusCode = response.status;
      throw error;
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Typhon execution timed out");
    }

    if (
      error.cause?.code === "ECONNREFUSED" ||
      error.cause?.code === "ENOTFOUND" ||
      error.message === "fetch failed"
    ) {
      throw new Error(
        `Typhon is unavailable at ${TYPHON_URL}. Start it from Typhon/runner.`
      );
    }

    throw error;
  }
};

const getLanguages = async () => {
  const languages = await requestTyphon("/languages", {}, 5000);
  return (Array.isArray(languages) ? languages : []).map((language) => ({
    id: language,
    name: language === "java" ? "Java 21" : "Python 3",
  }));
};

const validateExecution = ({ language, sourceCode, stdin }) => {
  if (!language || !["python", "java"].includes(language)) {
    throw new Error("Select a supported Typhon language");
  }

  if (!String(sourceCode || "").trim()) {
    throw new Error("Source code cannot be empty");
  }

  if (String(sourceCode).length > MAX_SOURCE_LENGTH) {
    throw new Error(`Source code cannot exceed ${MAX_SOURCE_LENGTH} characters`);
  }

  if (String(stdin || "").length > MAX_STDIN_LENGTH) {
    throw new Error(`Input cannot exceed ${MAX_STDIN_LENGTH} characters`);
  }
};

const executeTyphon = async ({ language, sourceCode, stdin = "" }) => {
  validateExecution({ language, sourceCode, stdin });
  // {
  //   "language": "string",
  //   "code": "string",
  //   "function_name": "string",
  //   "test_cases": [
  //     {
  //       "args": [
  //         "string"
  //       ],
  //       "expected_output": "string",
  //       "hidden": false
  //     }
  //   ],
  //   "stop_on_failure": false
  // }
  return requestTyphon(
    "/judge/function",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        language,
        code: String(sourceCode),
        stdin: String(stdin),
      }),
    },
    12000
  );
};

module.exports = {
  executeTyphon,
  getLanguages,
  requestTyphon,
};
