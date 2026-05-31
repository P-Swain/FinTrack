/**
 * api/accounts.api.js
 *
 * Wraps account-related backend endpoints.
 *
 * Endpoints (verified from backend/src/routes/account.routes.js):
 *   GET  /api/accounts           → { accounts[] }
 *   POST /api/accounts           → { message, account }
 *   GET  /api/accounts/:id       → { account }
 *
 * account shape: {
 *   id, account_number, account_type, balance, currency, status, created_at
 * }
 */

import api from "./axios";

/**
 * Fetch all accounts belonging to the authenticated user.
 * @returns {Promise<{ accounts: object[] }>}
 */
export function getMyAccounts() {
  return api.get("/accounts").then((res) => res.data);
}

/**
 * Create a new account for the authenticated user.
 * @param {{ account_type: string }} data  account_type: "savings" | "checking"
 * @returns {Promise<{ message: string, account: object }>}
 */
export function createAccount(data) {
  return api.post("/accounts", data).then((res) => res.data);
}

/**
 * Fetch a single account by its internal UUID.
 * The backend enforces ownership — a 403 is returned for wrong user.
 * @param {string} id - UUID
 * @returns {Promise<{ account: object }>}
 */
export function getAccountById(id) {
  return api.get(`/accounts/${id}`).then((res) => res.data);
}
