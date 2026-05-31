import pool from "../config/db.js";

// ── POST /api/transactions/deposit ────────────────────────────────────────────
export const deposit = async (req, res, next) => {
  try {
    const { account_number, amount, description } = req.body;

    // req.user.id comes from the verified JWT — the client cannot forge this.
    // Never read userId from req.body; that would let anyone impersonate another user.
    const userId = req.user.id;

    // ── Step 1: Resolve account_number → internal UUID, then verify ownership ──
    // External callers use account_number (user-friendly, 12 digits).
    // Internally, all DB foreign keys still reference accounts.id (UUID).
    const { rows: accountRows } = await pool.query(
      "SELECT id, user_id, status, account_number FROM accounts WHERE account_number = $1",
      [account_number]
    );

    if (accountRows.length === 0) {
      return res.status(404).json({ message: "Account not found" });
    }

    const account = accountRows[0];

    // Ownership check: DB value vs JWT value — client has no control over either
    if (account.user_id !== userId) {
      return res.status(403).json({ message: "Not your account" });
    }

    // Only active accounts can receive money; frozen/closed accounts must not be touched
    if (account.status !== "active") {
      return res.status(400).json({ message: "Account is not active" });
    }

    // Store the internal UUID — all subsequent queries use this, never account_number
    const accountId = account.id;

    // ── Step 2: Update the account balance ────────────────────────────────────
    // NOTE (Phase 5 intentional gap): This UPDATE and the INSERT below are two
    // separate queries with no DB transaction wrapper. If the server crashes
    // between them, the balance changes but no transaction record is created.
    // Phase 6 will fix this using BEGIN / COMMIT / ROLLBACK (ACID transactions).
    const { rows: updatedRows } = await pool.query(
      `UPDATE accounts
       SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, account_number, account_type, balance, currency, status, updated_at`,
      [amount, accountId]
    );

    const updatedAccount = updatedRows[0];

    // ── Step 3: Insert the transaction record ─────────────────────────────────
    // Deposit: money arrives from outside → from_account_id is NULL, to_account_id is the target UUID.
    // The DB stores UUIDs internally; we surface account_number to the caller in the response.
    const { rows: txRows } = await pool.query(
      `INSERT INTO transactions
         (from_account_id, to_account_id, user_id, transaction_type, amount, status, description)
       VALUES (NULL, $1, $2, 'deposit', $3, 'completed', $4)
       RETURNING id, transaction_type, amount, currency, status, description, created_at`,
      [accountId, userId, amount, description ?? "Deposit"]
    );

    return res.status(200).json({
      message: "Deposit successful",
      account: updatedAccount,
      transaction: {
        ...txRows[0],
        // Return the human-readable account number instead of the internal UUID
        to_account_number: updatedAccount.account_number,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/transactions/withdraw ───────────────────────────────────────────
export const withdraw = async (req, res, next) => {
  try {
    const { account_number, amount, description } = req.body;

    // Same ownership pattern: always read userId from the verified JWT, not the request body
    const userId = req.user.id;

    // ── Step 1: Resolve account_number → internal UUID, then verify ownership ──
    // We also SELECT balance here because we need it for the sufficiency check below.
    const { rows: accountRows } = await pool.query(
      "SELECT id, user_id, status, balance, account_number FROM accounts WHERE account_number = $1",
      [account_number]
    );

    if (accountRows.length === 0) {
      return res.status(404).json({ message: "Account not found" });
    }

    const account = accountRows[0];

    // Ownership check — same reasoning as deposit
    if (account.user_id !== userId) {
      return res.status(403).json({ message: "Not your account" });
    }

    // Only active accounts can send money
    if (account.status !== "active") {
      return res.status(400).json({ message: "Account is not active" });
    }

    // Balance check must happen BEFORE the UPDATE, not after.
    // The accounts table has CHECK (balance >= 0), so PostgreSQL would reject
    // an overdraft anyway, but checking here gives a clear user-facing message
    // and avoids a round-trip that we know will fail.
    if (Number(account.balance) < Number(amount)) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    // Store the internal UUID — all subsequent queries use this, never account_number
    const accountId = account.id;

    // ── Step 2: Deduct from the account balance ───────────────────────────────
    // NOTE (Phase 5 intentional gap): Two separate queries — no transaction wrapper.
    // A crash here would deduct the balance without creating a transaction record.
    // Phase 6 wraps both in BEGIN / COMMIT / ROLLBACK to prevent this.
    const { rows: updatedRows } = await pool.query(
      `UPDATE accounts
       SET balance = balance - $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, account_number, account_type, balance, currency, status, updated_at`,
      [amount, accountId]
    );

    const updatedAccount = updatedRows[0];

    // ── Step 3: Insert the transaction record ─────────────────────────────────
    // Withdrawal: money leaves the account → from_account_id is the source UUID, to_account_id is NULL.
    const { rows: txRows } = await pool.query(
      `INSERT INTO transactions
         (from_account_id, to_account_id, user_id, transaction_type, amount, status, description)
       VALUES ($1, NULL, $2, 'withdrawal', $3, 'completed', $4)
       RETURNING id, transaction_type, amount, currency, status, description, created_at`,
      [accountId, userId, amount, description ?? "Withdrawal"]
    );

    return res.status(200).json({
      message: "Withdrawal successful",
      account: updatedAccount,
      transaction: {
        ...txRows[0],
        // Return the human-readable account number instead of the internal UUID
        from_account_number: updatedAccount.account_number,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/transactions ─────────────────────────────────────────────────────
export const getTransactionHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // ── Query param extraction ────────────────────────────────────────────────
    const {
      account_number,
      transaction_type,
      from_date,
      to_date,
    } = req.query;

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;

    const allowedTransactionTypes = ["deposit", "withdrawal", "transfer", "refund"];

    if (transaction_type && !allowedTransactionTypes.includes(transaction_type)) {
      return res.status(400).json({
        message: "transaction_type must be one of: deposit, withdrawal, transfer, refund",
      });
    }

    const isValidDate = (value) => !Number.isNaN(Date.parse(value));

    if (from_date && !isValidDate(from_date)) {
      return res.status(400).json({
        message: "from_date must be a valid date",
      });
    }

    if (to_date && !isValidDate(to_date)) {
      return res.status(400).json({
        message: "to_date must be a valid date",
      });
    }
    // account_number is required
    if (!account_number || !/^\d{12}$/.test(account_number)) {
      return res.status(400).json({
        message: "account_number is required and must be exactly 12 digits",
      });
    }

    // ── Step 1: Resolve account_number → UUID and verify ownership ────────────
    const { rows: accountRows } = await pool.query(
      "SELECT id, user_id, account_number FROM accounts WHERE account_number = $1",
      [account_number]
    );

    if (accountRows.length === 0) {
      return res.status(404).json({ message: "Account not found" });
    }

    const account = accountRows[0];

    if (account.user_id !== userId) {
      return res.status(403).json({ message: "Not your account" });
    }

    const accountId = account.id;

    // ── Step 2: Build dynamic filter clauses (parameterized only) ─────────────
    // Start params with the two account-id references used in the WHERE clause
    const params = [accountId, accountId];  // $1 = from side, $2 = to side

    const filters = [];

    if (transaction_type) {
      params.push(transaction_type);
      filters.push(`t.transaction_type = $${params.length}`);
    }
    if (from_date) {
      params.push(from_date);
      filters.push(`t.created_at >= $${params.length}`);
    }
    if (to_date) {
      params.push(to_date);
      filters.push(`t.created_at <= $${params.length}`);
    }

    const filterClause = filters.length ? `AND ${filters.join(" AND ")}` : "";

    // ── Step 3: Main query with LEFT JOINs ────────────────────────────────────
    // Why LEFT JOIN?
    //   Deposits  → from_account_id IS NULL (no source account in our system)
    //   Withdrawals → to_account_id IS NULL (no destination account in our system)
    //   An INNER JOIN would drop those rows because the joined table has no match.
    //   LEFT JOIN keeps the row and returns NULL columns for the missing side.
    //
    // Direction logic:
    //   If this account is the FROM side → money left  → "debit"
    //   If this account is the TO   side → money arrived → "credit"
    const dataQuery = `
      SELECT
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
        CASE
          WHEN t.from_account_id = $1 THEN 'debit'
          ELSE 'credit'
        END AS direction
      FROM transactions t
      LEFT JOIN accounts fa ON fa.id = t.from_account_id
      LEFT JOIN accounts ta ON ta.id = t.to_account_id
      WHERE (t.from_account_id = $1 OR t.to_account_id = $2)
      ${filterClause}
      ORDER BY t.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);
    const { rows: transactions } = await pool.query(dataQuery, params);

    // ── Step 4: COUNT query using same filters (without LIMIT/OFFSET) ─────────
    const countParams = params.slice(0, params.length - 2); // drop limit & offset
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM transactions t
      WHERE (t.from_account_id = $1 OR t.to_account_id = $2)
      ${filterClause}
    `;
    const { rows: countRows } = await pool.query(countQuery, countParams);
    const total = parseInt(countRows[0].total, 10);
    const total_pages = Math.ceil(total / limit);

    return res.status(200).json({
      page,
      limit,
      total,
      total_pages,
      transactions,
    });
  } catch (error) {
    next(error);
  }
};

