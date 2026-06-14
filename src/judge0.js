const API_URL = process.env.REACT_APP_API_URL || "http://localhost:4001";

const request = async (path, options = {}) => {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
};

export const loadJudge0Languages = async () => {
  const data = await request("/api/judge0/languages");
  return data.languages || [];
};

export const runJudge0Code = (payload) =>
  request("/api/judge0/run", {
    method: "POST",
    body: JSON.stringify(payload),
  });
