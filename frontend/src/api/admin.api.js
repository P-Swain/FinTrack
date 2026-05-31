/**
 * api/admin.api.js
 *
 * Wraps all admin-only backend endpoints.
 * All routes require ADMIN role (enforced server-side by authorizeRoles middleware).
 *
 * Endpoints (verified from backend/src/routes/admin.routes.js):
 *   GET /api/admin/overview               → { total_users, total_accounts,
 *                                             total_completed_transactions,
 *                                             total_completed_volume,
 *                                             failed_transaction_count,
 *                                             suspicious_transfer_count }
 *   GET /api/admin/failed-transactions    → { page, limit, total, total_pages,
 *                                             failed_transactions[] }
 *   GET /api/admin/suspicious-transactions→ { page, limit, total, total_pages,
 *                                             suspicious_transactions[] }
 *   GET /api/admin/top-users              → { top_users[] }
 *   GET /api/admin/audit-logs             → { page, limit, total, total_pages,
 *                                             audit_logs[] }
 */

import api from "./axios";

/** @returns {Promise<object>} Overview stats */
export function getOverview() {
  return api.get("/admin/overview").then((res) => res.data);
}

/**
 * @param {{ page?: number, limit?: number }} params
 * @returns {Promise<object>}
 */
export function getFailedTransactions(params = {}) {
  return api.get("/admin/failed-transactions", { params }).then((res) => res.data);
}

/**
 * @param {{ page?: number, limit?: number }} params
 * @returns {Promise<object>}
 */
export function getSuspiciousTransactions(params = {}) {
  return api.get("/admin/suspicious-transactions", { params }).then((res) => res.data);
}

/**
 * @param {{ limit?: number }} params
 * @returns {Promise<object>}
 */
export function getTopUsers(params = {}) {
  return api.get("/admin/top-users", { params }).then((res) => res.data);
}

/**
 * @param {{ action?: string, page?: number, limit?: number }} params
 * @returns {Promise<object>}
 */
export function getAuditLogs(params = {}) {
  return api.get("/admin/audit-logs", { params }).then((res) => res.data);
}
