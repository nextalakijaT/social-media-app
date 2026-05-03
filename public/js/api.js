const BASE_URL = "http://localhost:3000/api";

// ─── Token helpers ────────────────────────────────────────────────────────────

const getToken = () => localStorage.getItem("token");
const getUser  = () => JSON.parse(localStorage.getItem("user") || "null");

const saveAuth = (token, user) => {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
};

const clearAuth = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};

const isLoggedIn = () => !!getToken();

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

const apiFetch = async (path, options = {}) => {
  const token = getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  const data = await res.json();

  // If token expired, log the user out and redirect to login
  if (res.status === 401 && data.message?.includes("expired")) {
    clearAuth();
    window.location.href = "/login.html";
  }

  return { ok: res.ok, status: res.status, data };
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

const signup = (body) =>
  apiFetch("/auth/signup", { method: "POST", body: JSON.stringify(body) });

const login = (body) =>
  apiFetch("/auth/login", { method: "POST", body: JSON.stringify(body) });

// ─── Posts ────────────────────────────────────────────────────────────────────

const getPosts = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return apiFetch(`/posts${query ? "?" + query : ""}`);
};

const getPost = (id) => apiFetch(`/posts/${id}`);

const getMyPosts = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return apiFetch(`/posts/me/posts${query ? "?" + query : ""}`);
};

const createPost = (body) =>
  apiFetch("/posts", { method: "POST", body: JSON.stringify(body) });

const updatePost = (id, body) =>
  apiFetch(`/posts/${id}`, { method: "PATCH", body: JSON.stringify(body) });

const deletePost = (id) =>
  apiFetch(`/posts/${id}`, { method: "DELETE" });

const likePost   = (id) => apiFetch(`/posts/${id}/like`, { method: "POST" });
const unlikePost = (id) => apiFetch(`/posts/${id}/like`, { method: "DELETE" });

// ─── Users ────────────────────────────────────────────────────────────────────

const followUser   = (id) => apiFetch(`/users/${id}/follow`, { method: "POST" });
const unfollowUser = (id) => apiFetch(`/users/${id}/follow`, { method: "DELETE" });
const getFollowing = ()   => apiFetch("/users/me/following");
const getFollowers = ()   => apiFetch("/users/me/followers");

// ─── UI Helpers ───────────────────────────────────────────────────────────────

const showError = (elementId, message) => {
  const el = document.getElementById(elementId);
  if (el) { el.textContent = message; el.style.display = "block"; }
};

const hideError = (elementId) => {
  const el = document.getElementById(elementId);
  if (el) el.style.display = "none";
};

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });

const requireAuth = () => {
  if (!isLoggedIn()) window.location.href = "/login.html";
};

const redirectIfLoggedIn = () => {
  if (isLoggedIn()) window.location.href = "/index.html";
};