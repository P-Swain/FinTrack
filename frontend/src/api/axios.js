/**
 * api/axios.js
 *
 * Creates a single shared Axios instance used by all API modules.
 * The base URL is read from the Vite environment variable so it can
 * be overridden per deployment without touching source code.
 *
 * setAuthToken(token) is the ONLY way other modules update the
 * Authorization header.  AuthContext calls it after a successful
 * login or on logout.  We deliberately do NOT import React context
 * here — that would create a circular dependency.
 */

import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api",
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * setAuthToken
 * Pass a token string to add "Authorization: Bearer <token>" to every
 * subsequent request.  Pass null or undefined to remove the header
 * (used on logout).
 *
 * @param {string|null} token
 */
export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }
}

export default api;
