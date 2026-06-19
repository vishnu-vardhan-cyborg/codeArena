const API_URL =
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_SOCKET_URL ||
  "http://localhost:4000";

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
    if (response.status === 404 && path.startsWith("/api/powerups")) {
      throw new Error(
        "Powerup backend route is missing. Stop the old port 4000 backend and restart with npm run start:socket."
      );
    }

    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
};

export const loadPowerupInventory = (userId) =>
  request(`/api/powerups?userId=${encodeURIComponent(userId)}`);

export const loadPendingCapsuleAttacks = ({ userId, capsuleId }) => {
  const params = new URLSearchParams();
  if (userId) params.set("userId", userId);
  if (capsuleId) params.set("capsuleId", capsuleId);

  const query = params.toString();
  return request(`/api/powerups/attacks${query ? `?${query}` : ""}`);
};

export const activateShield = (payload) =>
  request("/api/powerups/activate-shield", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const applyHuntReward = (payload) =>
  request("/api/powerups/hunt-reward", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const performCapsuleAttack = (payload) =>
  request("/api/powerups/attack", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const completeCapsuleAttackDefense = (payload) =>
  request("/api/powerups/attack/defend", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const runCapsuleMaintenance = () =>
  request("/api/time-capsules/maintenance", {
    method: "POST",
    body: JSON.stringify({}),
  });
