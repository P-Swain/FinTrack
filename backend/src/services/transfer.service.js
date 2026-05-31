import pool from "../config/db.js";

// ── transferFunds ─────────────────────────────────────────────────────────────
// Executes a funds transfer atomically using a PostgreSQL ACID transaction.
//
// Why pool.connect() instead of pool.query()?
//   pool.query() borrows a connection, runs one statement, then returns it.
//   An ACID transaction (BEGIN → multiple statements → COMMIT/ROLLBACK) must
//   run on the SAME physical connection the entire time. pool.connect() gives
//   us an exclusive client we control until we call client.release().
//
// Why SELECT ... FOR UPDATE?
//   Two concurrent transfers involving the same accounts could each read the
//   same balance, both decide "enough funds", and both deduct — resulting in
//   a negative balance. FOR UPDATE places a row-level lock so the second
//   transaction waits until the first commits or rolls back, guaranteeing that
//   each transfer sees the latest committed balance.
//
// Why pool.query() for failed_transactions after rollback?
//   After ROLLBACK, the client's transaction is finished. Depending on whether
//   the client errored mid-flight, it may be in an unusable state for the rest
//   of the current session. Using the pool for the failure log is safer — it
//   gets a clean connection independent of the rolled-back transaction.
//
export async function transferFunds({
  userId,
  from_account_id,
  to_account_id,
  amount,
  description,
  idempotency_key,
}) {
  // Acquire a dedicated connection that we hold across the entire transaction
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Step 1: Idempotency check ─────────────────────────────────────────────
    // We store idempotency_key in transactions.reference_id (VARCHAR 100, UNIQUE).
    // If the same key is submitted twice, we return the original transaction
    // without touching balances — making the endpoint safe to retry.
    const idempotencyCheck = await client.query(
      "SELECT * FROM transactions WHERE reference_id = $1",
      [idempotency_key]
    );

    if (idempotencyCheck.rows.length > 0) {
      // Already processed — commit (no-op) and return the existing record
      await client.query("COMMIT");
      return { transaction: idempotencyCheck.rows[0], isDuplicate: true };
    }

    // ── Step 2: Lock both account rows in deterministic order ─────────────────
    // Sorting IDs before locking means two concurrent transfers between the same
    // pair of accounts always lock in the same order, preventing deadlocks.
    const [firstId, secondId] = [from_account_id, to_account_id].sort();

    const { rows: lockedAccounts } = await client.query(
      `SELECT id, user_id, status, balance, account_number
       FROM accounts
       WHERE id IN ($1, $2)
       ORDER BY id
       FOR UPDATE`,
      [firstId, secondId]
    );

    // ── Step 3: Validate existence ────────────────────────────────────────────
    const sender   = lockedAccounts.find((a) => a.id === from_account_id);
    const receiver = lockedAccounts.find((a) => a.id === to_account_id);

    if (!sender) {
      const err = new Error("Sender account not found");
      err.status = 404;
      err.code = "SENDER_NOT_FOUND";
      throw err;
    }
    if (!receiver) {
      const err = new Error("Receiver account not found");
      err.status = 404;
      err.code = "RECEIVER_NOT_FOUND";
      throw err;
    }

    // ── Step 4: Ownership — only the authenticated user can move money out ─────
    // req.user.id (from JWT) is the ground truth; we never trust user_id from body
    if (sender.user_id !== userId) {
      const err = new Error("Not your account");
      err.status = 403;
      err.code = "FORBIDDEN";
      throw err;
    }

    // ── Step 5: Status checks ─────────────────────────────────────────────────
    if (sender.status !== "active") {
      const err = new Error("Sender account is not active");
      err.status = 400;
      err.code = "SENDER_INACTIVE";
      throw err;
    }
    if (receiver.status !== "active") {
      const err = new Error("Receiver account is not active");
      err.status = 400;
      err.code = "RECEIVER_INACTIVE";
      throw err;
    }

    // ── Step 6: Balance check ─────────────────────────────────────────────────
    // Check before the UPDATE so we surface a clear message rather than relying
    // on the CHECK (balance >= 0) constraint to reject the row with a cryptic error.
    if (Number(sender.balance) < Number(amount)) {
      const err = new Error("Insufficient balance");
      err.status = 400;
      err.code = "INSUFFICIENT_FUNDS";
      throw err;
    }

    // ── Step 7: Deduct from sender ────────────────────────────────────────────
    await client.query(
      `UPDATE accounts
       SET balance = balance - $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [amount, from_account_id]
    );

    // ── Step 8: Credit receiver ───────────────────────────────────────────────
    await client.query(
      `UPDATE accounts
       SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [amount, to_account_id]
    );

    // ── Step 9: Insert transaction record ─────────────────────────────────────
    // transaction_type must match CHECK constraint: 'transfer'
    // status must match CHECK constraint: 'completed'
    // reference_id stores the idempotency_key (unique, so duplicate keys fail fast)
    // Suspicious flag: stored in the audit log metadata below (no column in schema)
    const isSuspicious = Number(amount) >= 50000;

    const { rows: txRows } = await client.query(
      `INSERT INTO transactions
         (from_account_id, to_account_id, user_id,
          transaction_type, amount, status, description, reference_id)
       VALUES ($1, $2, $3, 'transfer', $4, 'completed', $5, $6)
       RETURNING id, from_account_id, to_account_id, transaction_type,
                 amount, currency, status, description, reference_id, created_at`,
      [
        from_account_id,
        to_account_id,
        userId,
        amount,
        description ?? "Transfer",
        idempotency_key,
      ]
    );

    const newTransaction = txRows[0];

    // ── Step 10: Audit log ────────────────────────────────────────────────────
    // audit_logs is append-only; we capture full context including suspicious flag
    await client.query(
      `INSERT INTO audit_logs
         (user_id, action, entity_type, entity_id, new_value, metadata)
       VALUES ($1, 'TRANSFER_COMPLETED', 'transaction', $2, $3, $4)`,
      [
        userId,
        newTransaction.id,
        JSON.stringify({
          from_account_id,
          to_account_id,
          amount,
          status: "completed",
        }),
        JSON.stringify({
          idempotency_key,
          is_suspicious: isSuspicious,
          from_account_number: sender.account_number,
          to_account_number:   receiver.account_number,
        }),
      ]
    );

    // ── Step 11: Commit ───────────────────────────────────────────────────────
    await client.query("COMMIT");

    return {
      transaction: {
        ...newTransaction,
        is_suspicious: isSuspicious,
        from_account_number: sender.account_number,
        to_account_number:   receiver.account_number,
      },
      isDuplicate: false,
    };
  } catch (error) {
    // ── Rollback: undo every change made since BEGIN ──────────────────────────
    await client.query("ROLLBACK");

    // ── Log failure using pool (not client) ───────────────────────────────────
    // After ROLLBACK the client's session state is reset/potentially broken.
    // Using pool.query() gets a fresh, clean connection from the pool that is
    // completely independent of the failed transaction, guaranteeing the failure
    // log is written even if the client is in an error state.
    try {
      await pool.query(
        `INSERT INTO failed_transactions
           (user_id, from_account_id, to_account_id, amount, failure_reason, error_code)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userId,
          from_account_id ?? null,
          to_account_id   ?? null,
          amount,
          error.message || "Unknown error",
          error.code    || "UNKNOWN",
        ]
      );
    } catch (logError) {
      // Failure logging must never mask the original error
      console.error("Failed to log failed_transaction:", logError.message);
    }

    throw error; // rethrow so controller → global error handler sends the response
  } finally {
    // Always release the client back to the pool, even if commit or rollback threw
    client.release();
  }
}
