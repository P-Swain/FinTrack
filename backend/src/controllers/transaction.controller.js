import pool from "../config/db.js";

// ── POST /api/transactions/deposit ────────────────────────────────────────────
export const deposit = async (req, res, next) => {
  try {
    const { account_id, amount, description } = req.body;

    // req.user.id comes from the verified JWT — the client cannot forge this.
    // Never read userId from req.body; that would let anyone impersonate another user.
    const userId = req.user.id;

    // ── Step 1: Fetch the account and verify ownership ────────────────────────
    const { rows: accountRows } = await pool.query(
      "SELECT id, user_id, status FROM accounts WHERE id = $1",
      [account_id]
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
      [amount, account_id]
    );

    const updatedAccount = updatedRows[0];

    // ── Step 3: Insert the transaction record ─────────────────────────────────
    // Deposit: money arrives from outside → from_account_id is NULL, to_account_id is the target
    const { rows: txRows } = await pool.query(
      `INSERT INTO transactions
         (from_account_id, to_account_id, user_id, transaction_type, amount, status, description)
       VALUES (NULL, $1, $2, 'deposit', $3, 'completed', $4)
       RETURNING id, to_account_id, transaction_type, amount, currency, status, description, created_at`,
      [account_id, userId, amount, description ?? "Deposit"]
    );

    return res.status(200).json({
      message: "Deposit successful",
      account: updatedAccount,
      transaction: txRows[0],
    });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/transactions/withdraw ───────────────────────────────────────────
export const withdraw = async (req, res, next) => {
  try {
    const { account_id, amount, description } = req.body;

    // Same ownership pattern: always read userId from the verified JWT, not the request body
    const userId = req.user.id;

    // ── Step 1: Fetch the account and verify ownership ────────────────────────
    // We also SELECT balance here because we need it for the sufficiency check
    const { rows: accountRows } = await pool.query(
      "SELECT id, user_id, status, balance FROM accounts WHERE id = $1",
      [account_id]
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

    // ── Step 2: Deduct from the account balance ───────────────────────────────
    // NOTE (Phase 5 intentional gap): Two separate queries — no transaction wrapper.
    // A crash here would deduct the balance without creating a transaction record.
    // Phase 6 wraps both in BEGIN / COMMIT / ROLLBACK to prevent this.
    const { rows: updatedRows } = await pool.query(
      `UPDATE accounts
       SET balance = balance - $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, account_number, account_type, balance, currency, status, updated_at`,
      [amount, account_id]
    );

    const updatedAccount = updatedRows[0];

    // ── Step 3: Insert the transaction record ─────────────────────────────────
    // Withdrawal: money leaves the account → from_account_id is the source, to_account_id is NULL
    const { rows: txRows } = await pool.query(
      `INSERT INTO transactions
         (from_account_id, to_account_id, user_id, transaction_type, amount, status, description)
       VALUES ($1, NULL, $2, 'withdrawal', $3, 'completed', $4)
       RETURNING id, from_account_id, transaction_type, amount, currency, status, description, created_at`,
      [account_id, userId, amount, description ?? "Withdrawal"]
    );

    return res.status(200).json({
      message: "Withdrawal successful",
      account: updatedAccount,
      transaction: txRows[0],
    });
  } catch (error) {
    next(error);
  }
};
