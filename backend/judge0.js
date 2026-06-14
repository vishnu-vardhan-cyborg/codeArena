const JUDGE0_URL = String(
  process.env.JUDGE0_URL || "http://localhost:2358"
).replace(/\/+$/, "");

const MAX_SOURCE_LENGTH = 50000;
const MAX_STDIN_LENGTH = 10000;
const POLL_INTERVAL_MS = 350;
const POLL_TIMEOUT_MS = 20000;

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const fetchWithTimeout = async (url, options = {}, timeoutMs = 5000) => {
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

const parseJudge0Response = async (response) => {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
};

const requestJudge0 = async (path, options = {}, timeoutMs) => {
  try {
    const response = await fetchWithTimeout(
      `${JUDGE0_URL}${path}`,
      options,
      timeoutMs
    );
    const data = await parseJudge0Response(response);

    if (!response.ok) {
      const error = new Error(
        data.error || data.message || `Judge0 request failed (${response.status})`
      );
      error.statusCode = response.status;
      throw error;
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Judge0 request timed out");
    }

    if (
      error.cause?.code === "ECONNREFUSED" ||
      error.cause?.code === "ENOTFOUND" ||
      error.message === "fetch failed"
    ) {
      throw new Error(
        `Judge0 is unavailable at ${JUDGE0_URL}. Start it with npm run judge0:up`
      );
    }

    throw error;
  }
};

const readJsonBody = (request) =>
  new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > 100000) {
        reject(new Error("Request body is too large"));
        request.destroy();
      }
    });

    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Request body must be valid JSON"));
      }
    });

    request.on("error", reject);
  });

const getLanguages = async () => {
  const languages = await requestJudge0("/languages", {}, 5000);

  return Array.isArray(languages)
    ? languages.sort((a, b) => a.name.localeCompare(b.name))
    : [];
};

const createSubmission = async ({ languageId, sourceCode, stdin }) => {
  return requestJudge0(
    "/submissions?base64_encoded=false&wait=false",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        language_id: languageId,
        source_code: sourceCode,
        stdin,
        cpu_time_limit: 3,
        wall_time_limit: 8,
        memory_limit: 128000,
        enable_network: false,
      }),
    },
    7000
  );
};

const getSubmission = async (token) => {
  const fields = [
    "stdout",
    "stderr",
    "compile_output",
    "message",
    "status",
    "time",
    "memory",
  ].join(",");

  return requestJudge0(
    `/submissions/${encodeURIComponent(token)}?base64_encoded=false&fields=${fields}`,
    {},
    5000
  );
};

const waitForSubmission = async (token) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    const submission = await getSubmission(token);

    if (Number(submission.status?.id) > 2) {
      return submission;
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error("Code execution timed out while waiting for Judge0");
};

const runCode = async (payload = {}) => {
  const languageId = Number(payload.languageId);
  const sourceCode = String(payload.sourceCode || "");
  const stdin = String(payload.stdin || "");

  if (!Number.isInteger(languageId) || languageId <= 0) {
    throw new Error("Select a valid programming language");
  }

  if (!sourceCode.trim()) {
    throw new Error("Source code cannot be empty");
  }

  if (sourceCode.length > MAX_SOURCE_LENGTH) {
    throw new Error(`Source code cannot exceed ${MAX_SOURCE_LENGTH} characters`);
  }

  if (stdin.length > MAX_STDIN_LENGTH) {
    throw new Error(`Input cannot exceed ${MAX_STDIN_LENGTH} characters`);
  }

  const submission = await createSubmission({
    languageId,
    sourceCode,
    stdin,
  });

  if (!submission.token) {
    throw new Error(submission.error || "Judge0 did not return a submission token");
  }

  return waitForSubmission(submission.token);
};

const sendJson = (response, statusCode, data) => {
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
  });
  response.end(JSON.stringify(data));
};

const handleJudge0Request = async (request, response, pathname) => {
  if (request.method === "GET" && pathname === "/api/judge0/health") {
    const systemInfo = await requestJudge0("/system_info", {}, 5000);
    sendJson(response, 200, {
      ok: true,
      version: systemInfo.version,
    });
    return true;
  }

  if (request.method === "GET" && pathname === "/api/judge0/languages") {
    sendJson(response, 200, {
      languages: await getLanguages(),
    });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/judge0/run") {
    const payload = await readJsonBody(request);
    sendJson(response, 200, await runCode(payload));
    return true;
  }

  return false;
};

module.exports = {
  handleJudge0Request,
  sendJson,
};
