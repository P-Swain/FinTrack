/**
 * api/transactions.api.js
 *
 * Wraps transaction-related backend endpoints.
 *
 * Endpoints (verified from backend/src/routes/transaction.routes.js
 *            and backend/src/controllers/transaction.controller.js):
 *
 *   GET  /api/transactions
 *     Query params:
 *       account_number  (REQUIRED — 12-digit string)
 *       transaction_type (optional: "deposit" | "withdrawal" | "transfer" | "refund")
 *       from_date        (optional ISO date string)
 *       to_date          (optional ISO date string)
 *       page             (optional, default 1)
 *       limit            (optional, default 10, max 100)
 *     Response: { page, limit, total, total_pages, transactions[] }
 *
 *   transaction shape: {
 *     id, transaction_type, amount, currency, status, description,
 *     reference_id, created_at, from_account_number, to_account_number, direction
 *   }
 *   direction: "debit" | "credit"
 *
 *   POST /api/transactions/deposit
 *     Body: { account_number, amount, description? }
 *     Response: { message, account, transaction }
 *
 *   POST /api/transactions/withdraw
 *     Body: { account_number, amount, description? }
 *     Response: { message, account, transaction }
 */

import api from "./axios";

/**
 * Fetch paginated transaction history for a given account.
 *
 * NOTE: account_number (12-digit string) is REQUIRED by the backend.
 * The backend validates it and returns 400 if missing or malformed.
 *
 * @param {object} params
 * @param {string} params.account_number  - Required 12-digit account number
 * @param {string} [params.transaction_type]
 * @param {string} [params.from_date]      - ISO date string
 * @param {string} [params.to_date]        - ISO date string
 * @param {number} [params.page]
 * @param {number} [params.limit]
 * @returns {Promise<{ page, limit, total, total_pages, transactions: object[] }>}
 */
export function getTransactionHistory(params) {
  // Remove undefined/empty keys so they don't appear as &key= in the URL
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== "" && v !== null)
  );
  return api.get("/transactions", { params: cleanParams }).then((res) => res.data);
}

/**
 * Deposit funds into an account.
 * @param {{ account_number: string, amount: number, description?: string }} data
 * @returns {Promise<{ message: string, account: object, transaction: object }>}
 */
export function deposit(data) {
  return api.post("/transactions/deposit", data).then((res) => res.data);
}

/**
 * Withdraw funds from an account.
 * @param {{ account_number: string, amount: number, description?: string }} data
 * @returns {Promise<{ message: string, account: object, transaction: object }>}
 */
export function withdraw(data) {
  return api.post("/transactions/withdraw", data).then((res) => res.data);
}
