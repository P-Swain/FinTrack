/**
 * api/auth.api.js
 *
 * Wraps every auth-related backend endpoint.
 *
 * Endpoints (verified from backend/src/routes/auth.routes.js):
 *   POST /api/auth/register  → { message, user }
 *   POST /api/auth/login     → { message, token, user }
 *   GET  /api/auth/me        → { user }   (requires Authorization header)
 *
 * user shape: { id, full_name, email, role, created_at }
 */

import api from "./axios";

/**
 * Register a new user account.
 * @param {{ full_name: string, email: string, password: string }} data
 * @returns {Promise<{ message: string, user: object }>}
 */
export function registerUser(data) {
  return api.post("/auth/register", data).then((res) => res.data);
}

/**
 * Login with email and password.
 * @param {{ email: string, password: string }} data
 * @returns {Promise<{ message: string, token: string, user: object }>}
 */
export function loginUser(data) {
  return api.post("/auth/login", data).then((res) => res.data);
}

/**
 * Fetch the currently authenticated user (uses Authorization header).
 * @returns {Promise<{ user: object }>}
 */
export function getMe() {
  return api.get("/auth/me").then((res) => res.data);
}
