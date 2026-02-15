const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Request failed");
  }

  return response.json();
};

export const api = {
  createUser: (payload) => request("/users", { method: "POST", body: JSON.stringify(payload) }),
  upsertGoal: (payload) => request("/goals", { method: "POST", body: JSON.stringify(payload) }),
  logActivity: (payload) => request("/activity", { method: "POST", body: JSON.stringify(payload) }),
  getDashboard: (username) => request(`/dashboard/${username}`)
};
