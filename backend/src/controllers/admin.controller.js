import pool from "../config/db.js";

// ── GET /api/admin/overview ───────────────────────────────────────────────────
export const getOverview = async (_req, res, next) => {
  try {
    // Run all count/sum queries in parallel for performance
    const [
      usersResult,
      accountsResult,
      txResult,
      failedResult,
      suspiciousResult,
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) AS total FROM users"),

      pool.query("SELECT COUNT(*) AS total FROM accounts"),

      pool.query(`
        SELECT
          COUNT(*)                         AS total_transactions,
          COALESCE(SUM(amount), 0)         AS total_volume
        FROM transactions
        WHERE status = 'completed'
      `),

      pool.query("SELECT COUNT(*) AS total FROM failed_transactions"),

      // Suspicious transfers are stored in audit_logs.metadata, not a column
      // in transactions. We look for rows where the JSON metadata flag is 'true'.
      pool.query(`
        SELECT COUNT(*) AS total
        FROM audit_logs
        WHERE action = 'TRANSFER_COMPLETED'
          AND metadata->>'is_suspicious' = 'true'
      `),
    ]);

    return res.status(200).json({
      total_users:                parseInt(usersResult.rows[0].total, 10),
      total_accounts:             parseInt(accountsResult.rows[0].total, 10),
      total_completed_transactions: parseInt(txResult.rows[0].total_transactions, 10),
      total_completed_volume:     parseFloat(txResult.rows[0].total_volume),
      failed_transaction_count:   parseInt(failedResult.rows[0].total, 10),
      suspicious_transfer_count:  parseInt(suspiciousResult.rows[0].total, 10),
    });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/admin/failed-transactions ────────────────────────────────────────
export const getFailedTransactions = async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    // Join users for email context; join accounts for human-readable account numbers
    const { rows } = await pool.query(
      `SELECT
         ft.id,
         ft.amount,
         ft.currency,
         ft.failure_reason,
         ft.error_code,
         ft.attempted_at,
         u.email           AS user_email,
         u.full_name       AS user_full_name,
         fa.account_number AS from_account_number,
         ta.account_number AS to_account_number
       FROM failed_transactions ft
       JOIN users u              ON u.id  = ft.user_id
       LEFT JOIN accounts fa     ON fa.id = ft.from_account_id
       LEFT JOIN accounts ta     ON ta.id = ft.to_account_id
       ORDER BY ft.attempted_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const { rows: countRows } = await pool.query(
      "SELECT COUNT(*) AS total FROM failed_transactions"
    );
    const total = parseInt(countRows[0].total, 10);

    return res.status(200).json({
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
      failed_transactions: rows,
    });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/admin/suspicious-transactions ────────────────────────────────────
// The transactions table has no is_suspicious column.
// Suspicious transfers are identified via audit_logs.metadata where the service
// stored is_suspicious: true for transfers with amount >= 50000.
export const getSuspiciousTransactions = async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const { rows } = await pool.query(
      `SELECT
         t.id,
         t.transaction_type,
         t.amount,
         t.currency,
         t.status,
         t.description,
         t.reference_id,
         t.created_at,
         fa.account_number  AS from_account_number,
         ta.account_number  AS to_account_number,
         u.email            AS user_email,
         u.full_name        AS user_full_name,
         al.metadata        AS audit_metadata
       FROM audit_logs al
       JOIN transactions t        ON t.id  = al.entity_id
       JOIN users u               ON u.id  = al.user_id
       LEFT JOIN accounts fa      ON fa.id = t.from_account_id
       LEFT JOIN accounts ta      ON ta.id = t.to_account_id
       WHERE al.action = 'TRANSFER_COMPLETED'
         AND al.metadata->>'is_suspicious' = 'true'
       ORDER BY t.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const { rows: countRows } = await pool.query(`
      SELECT COUNT(*) AS total
      FROM audit_logs
      WHERE action = 'TRANSFER_COMPLETED'
        AND metadata->>'is_suspicious' = 'true'
    `);
    const total = parseInt(countRows[0].total, 10);

    return res.status(200).json({
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
      suspicious_transactions: rows,
    });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/admin/top-users ──────────────────────────────────────────────────
// Counts transactions and volume per user.
//
// Why NOT: JOIN transactions t ON t.from_account_id = a.id OR t.to_account_id = a.id
//   If User A owns both the sender and receiver accounts in a transfer, the OR
//   join matches the same transaction row twice — double-counting it.
//
// Why CTE with UNION ALL + DISTINCT:
//   We collect (user_id, transaction_id) pairs from both sides of every transaction,
//   deduplicate using SELECT DISTINCT, then aggregate. Each transaction is counted
//   at most once per user even if they own both accounts involved.
export const getTopUsers = async (req, res, next) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

    const { rows } = await pool.query(
      `WITH participating AS (
         -- All (user_id, transaction_id, amount) pairs from the sender side
         SELECT a.user_id, t.id AS transaction_id, t.amount
         FROM transactions t
         JOIN accounts a ON a.id = t.from_account_id
         WHERE t.status = 'completed'

         UNION ALL

         -- All (user_id, transaction_id, amount) pairs from the receiver side
         SELECT a.user_id, t.id AS transaction_id, t.amount
         FROM transactions t
         JOIN accounts a ON a.id = t.to_account_id
         WHERE t.status = 'completed'
       ),
       deduplicated AS (
         -- One row per (user, transaction) — eliminates double-count when the
         -- same user owns both the from and to account in a transfer
         SELECT DISTINCT user_id, transaction_id, amount
         FROM participating
       )
       SELECT
         u.id,
         u.full_name,
         u.email,
         COUNT(d.transaction_id)  AS transaction_count,
         COALESCE(SUM(d.amount), 0) AS total_volume
       FROM deduplicated d
       JOIN users u ON u.id = d.user_id
       GROUP BY u.id, u.full_name, u.email
       ORDER BY total_volume DESC
       LIMIT $1`,
      [limit]
    );

    return res.status(200).json({ top_users: rows });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/admin/audit-logs ─────────────────────────────────────────────────
export const getAuditLogs = async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const { action } = req.query;

    const params = [];
    let filterClause = "";

    if (action) {
      params.push(action.toUpperCase());
      filterClause = `WHERE al.action = $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT
         al.id,
         al.action,
         al.entity_type,
         al.entity_id,
         al.old_value,
         al.new_value,
         al.metadata,
         al.ip_address,
         al.created_at,
         u.email     AS user_email,
         u.full_name AS user_full_name
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ${filterClause}
       ORDER BY al.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) AS total FROM audit_logs al ${filterClause}`,
      params
    );
    const total = parseInt(countRows[0].total, 10);

    return res.status(200).json({
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
      audit_logs: rows,
    });
  } catch (error) {
    next(error);
  }
};
