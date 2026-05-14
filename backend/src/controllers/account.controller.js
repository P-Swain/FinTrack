import pool from "../config/db.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Generates a random 12-digit account number.
 * For learning purposes only — not guaranteed globally unique without a DB check,
 * but the UNIQUE constraint + retry loop below makes it safe in practice.
 */
function generateAccountNumber() {
  return Math.floor(100000000000 + Math.random() * 900000000000).toString();
}

// ── POST /api/accounts ────────────────────────────────────────────────────────
export const createAccount = async (req, res, next) => {
  try {
    // user_id always comes from the verified JWT payload — never from req.body
    const userId = req.user.id;
    const { account_type } = req.body;

    // Retry loop: handles the rare case where a generated account number
    // collides with an existing one (PostgreSQL error code 23505)
    const MAX_ATTEMPTS = 5;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const accountNumber = generateAccountNumber();

      try {
        const { rows } = await pool.query(
          `INSERT INTO accounts (user_id, account_number, account_type)
           VALUES ($1, $2, $3)
           RETURNING id, user_id, account_number, account_type,
                     balance, currency, status, created_at`,
          [userId, accountNumber, account_type]
        );

        return res.status(201).json({
          message: "Account created successfully",
          account: rows[0],
        });
      } catch (insertError) {
        // 23505 = unique_violation — only retry for account_number conflicts
        if (insertError.code === "23505" && attempt < MAX_ATTEMPTS) {
          continue; // try a new account number
        }
        throw insertError; // any other error (or final attempt) → bubble up
      }
    }

    // Reached only if all attempts collided (extremely unlikely)
    return res.status(500).json({
      message: "Could not generate a unique account number. Please try again.",
    });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/accounts ─────────────────────────────────────────────────────────
export const getMyAccounts = async (req, res, next) => {
  try {
    // Only returns accounts belonging to the authenticated user
    const userId = req.user.id;

    const { rows } = await pool.query(
      `SELECT id, account_number, account_type, balance, currency, status, created_at
       FROM accounts
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return res.status(200).json({ accounts: rows });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/accounts/:id ─────────────────────────────────────────────────────
export const getAccountById = async (req, res, next) => {
  try {
    const userId    = req.user.id;        // from JWT — always trusted
    const accountId = req.params.id;      // from URL — untrusted until ownership verified

    const { rows } = await pool.query(
      `SELECT id, user_id, account_number, account_type,
              balance, currency, status, created_at
       FROM accounts
       WHERE id = $1`,
      [accountId]
    );

    // 1. Account not found
    if (rows.length === 0) {
      return res.status(404).json({ message: "Account not found" });
    }

    const account = rows[0];

    // 2. Account exists but belongs to a different user → 403
    if (account.user_id !== userId) {
      return res.status(403).json({ message: "Not your account" });
    }

    // 3. Ownership confirmed — return the account
    return res.status(200).json({ account });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/accounts/number/:account_number ──────────────────────────────────
// User-facing lookup by the human-readable 12-digit account number.
// This route is mounted BEFORE /:id in account.routes.js so Express doesn't
// misinterpret "number" as an :id segment.
export const getAccountByNumber = async (req, res, next) => {
  try {
    const userId        = req.user.id;                  // from JWT — always trusted
    const accountNumber = req.params.account_number;    // from URL — untrusted until validated

    // Validate format in-controller (Zod is not applied to URL params here)
    if (!/^\d{12}$/.test(accountNumber)) {
      return res.status(400).json({ message: "Invalid account number" });
    }

    const { rows } = await pool.query(
      `SELECT id, user_id, account_number, account_type,
              balance, currency, status, created_at
       FROM accounts
       WHERE account_number = $1`,
      [accountNumber]
    );

    // 1. Account not found
    if (rows.length === 0) {
      return res.status(404).json({ message: "Account not found" });
    }

    const account = rows[0];

    // 2. Ownership check — same pattern as getAccountById
    if (account.user_id !== userId) {
      return res.status(403).json({ message: "Not your account" });
    }

    // 3. Ownership confirmed — return the account
    return res.status(200).json({ account });
  } catch (error) {
    next(error);
  }
};

