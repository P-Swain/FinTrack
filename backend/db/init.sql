-- =============================================================================
-- FinTrack Database Schema
-- =============================================================================
-- This file initializes the PostgreSQL database for FinTrack,
-- a personal finance / mini banking application.
--
-- Run order matters: extensions → tables (dependency order) → indexes
--
-- To run manually:
--   psql -U fintrack_user -d fintrack_db -f init.sql
-- =============================================================================


-- ---------------------------------------------------------------------------
-- EXTENSION: uuid-ossp
-- Provides uuid_generate_v4() to auto-generate UUIDs for primary keys.
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- =============================================================================
-- TABLE: users
-- =============================================================================
-- Stores registered users of the FinTrack application.
-- Every other table links back to this table via user_id.
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name       VARCHAR(100)    NOT NULL,
    email           VARCHAR(255)    NOT NULL UNIQUE,
    password_hash   TEXT            NOT NULL,           -- bcrypt/argon2 hash, never plain text
    phone           VARCHAR(20),
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  users                IS 'Registered FinTrack users. Central table — all others reference this.';
COMMENT ON COLUMN users.id             IS 'UUID primary key, auto-generated.';
COMMENT ON COLUMN users.email          IS 'Must be unique across all users. Used for login.';
COMMENT ON COLUMN users.password_hash  IS 'Hashed password. Never store plain text passwords.';
COMMENT ON COLUMN users.is_active      IS 'FALSE = soft-deleted or banned user.';


-- =============================================================================
-- TABLE: accounts
-- =============================================================================
-- Bank-like accounts owned by users (e.g., savings, checking).
-- A user can have multiple accounts. Balance is stored in minor units
-- (e.g., paisa/cents) to avoid floating-point precision issues — but
-- here we use NUMERIC for readability.
-- =============================================================================
CREATE TABLE IF NOT EXISTS accounts (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_number  VARCHAR(20)     NOT NULL UNIQUE,    -- human-friendly account identifier
    account_type    VARCHAR(20)     NOT NULL,
    balance         NUMERIC(15, 2)  NOT NULL DEFAULT 0.00,
    currency        CHAR(3)         NOT NULL DEFAULT 'INR',
    status          VARCHAR(20)     NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Balance must never go negative
    CONSTRAINT chk_accounts_balance     CHECK (balance >= 0),

    -- Only allow known account types
    CONSTRAINT chk_accounts_type        CHECK (account_type IN ('savings', 'checking', 'wallet')),

    -- Only allow known account statuses
    CONSTRAINT chk_accounts_status      CHECK (status IN ('active', 'inactive', 'frozen', 'closed'))
);

COMMENT ON TABLE  accounts                 IS 'Bank-like accounts owned by users. One user can have many accounts.';
COMMENT ON COLUMN accounts.user_id         IS 'FK → users.id. Cascades delete if user is removed.';
COMMENT ON COLUMN accounts.account_number  IS 'Human-readable account number (e.g., ACC-00123456).';
COMMENT ON COLUMN accounts.account_type    IS 'savings | checking | wallet';
COMMENT ON COLUMN accounts.balance         IS 'Current balance in the account. Cannot be negative.';
COMMENT ON COLUMN accounts.currency        IS 'ISO 4217 currency code (e.g., INR, USD).';
COMMENT ON COLUMN accounts.status          IS 'active | inactive | frozen | closed';


-- =============================================================================
-- TABLE: beneficiaries
-- =============================================================================
-- Saved payees that a user can send money to.
-- Stores the destination account details for quick repeat transfers.
-- =============================================================================
CREATE TABLE IF NOT EXISTS beneficiaries (
    id                      UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nickname                VARCHAR(100),                       -- optional friendly name like "Mom" or "Landlord"
    beneficiary_name        VARCHAR(100)    NOT NULL,
    beneficiary_account_no  VARCHAR(20)     NOT NULL,
    bank_name               VARCHAR(100),
    ifsc_code               VARCHAR(20),                        -- Indian Financial System Code (routing)
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  beneficiaries                        IS 'Saved payees for a user. Used for quick repeat transfers.';
COMMENT ON COLUMN beneficiaries.user_id                IS 'FK → users.id. The user who saved this beneficiary.';
COMMENT ON COLUMN beneficiaries.nickname               IS 'Optional label, e.g., "Mom", "Landlord".';
COMMENT ON COLUMN beneficiaries.beneficiary_account_no IS 'Destination bank account number.';
COMMENT ON COLUMN beneficiaries.ifsc_code              IS 'Bank routing code (IFSC for India, ABA/routing for US).';


-- =============================================================================
-- TABLE: transactions
-- =============================================================================
-- Records every money movement: deposits, withdrawals, and transfers.
-- For transfers, both from_account_id and to_account_id are populated.
-- =============================================================================
CREATE TABLE IF NOT EXISTS transactions (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_account_id     UUID            REFERENCES accounts(id) ON DELETE SET NULL,  -- NULL for deposits from external
    to_account_id       UUID            REFERENCES accounts(id) ON DELETE SET NULL,  -- NULL for withdrawals to external
    user_id             UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_type    VARCHAR(20)     NOT NULL,
    amount              NUMERIC(15, 2)  NOT NULL,
    currency            CHAR(3)         NOT NULL DEFAULT 'INR',
    status              VARCHAR(20)     NOT NULL DEFAULT 'pending',
    description         TEXT,
    reference_id        VARCHAR(100)    UNIQUE,             -- external payment gateway reference
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Amount must always be a positive number
    CONSTRAINT chk_transactions_amount  CHECK (amount > 0),

    -- Only allow known transaction types
    CONSTRAINT chk_transactions_type    CHECK (transaction_type IN ('deposit', 'withdrawal', 'transfer', 'refund')),

    -- Only allow known transaction statuses
    CONSTRAINT chk_transactions_status  CHECK (status IN ('pending', 'completed', 'failed', 'reversed'))
);

COMMENT ON TABLE  transactions                   IS 'Every money movement: deposits, withdrawals, transfers, refunds.';
COMMENT ON COLUMN transactions.from_account_id   IS 'FK → accounts.id. Source account. NULL if money comes from outside.';
COMMENT ON COLUMN transactions.to_account_id     IS 'FK → accounts.id. Destination account. NULL if money goes outside.';
COMMENT ON COLUMN transactions.transaction_type  IS 'deposit | withdrawal | transfer | refund';
COMMENT ON COLUMN transactions.amount            IS 'Transaction amount. Must be > 0.';
COMMENT ON COLUMN transactions.status            IS 'pending | completed | failed | reversed';
COMMENT ON COLUMN transactions.reference_id      IS 'Optional external reference (e.g., Razorpay/Stripe txn ID).';


-- =============================================================================
-- TABLE: failed_transactions
-- =============================================================================
-- A dedicated log for transactions that failed, including the error reason.
-- Useful for debugging, fraud detection, and customer support.
-- =============================================================================
CREATE TABLE IF NOT EXISTS failed_transactions (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id      UUID            REFERENCES transactions(id) ON DELETE SET NULL,
    user_id             UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    from_account_id     UUID            REFERENCES accounts(id) ON DELETE SET NULL,
    to_account_id       UUID            REFERENCES accounts(id) ON DELETE SET NULL,
    amount              NUMERIC(15, 2)  NOT NULL,
    currency            CHAR(3)         NOT NULL DEFAULT 'INR',
    failure_reason      TEXT            NOT NULL,             -- human-readable error message
    error_code          VARCHAR(50),                          -- machine-readable error code
    attempted_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_failed_txn_amount CHECK (amount > 0)
);

COMMENT ON TABLE  failed_transactions                IS 'Logs every transaction that failed, with the reason why.';
COMMENT ON COLUMN failed_transactions.transaction_id IS 'FK → transactions.id. Links back to the original transaction attempt.';
COMMENT ON COLUMN failed_transactions.failure_reason IS 'Human-readable explanation, e.g., "Insufficient balance".';
COMMENT ON COLUMN failed_transactions.error_code     IS 'Machine-readable code, e.g., "INSUFFICIENT_FUNDS".';


-- =============================================================================
-- TABLE: login_sessions
-- =============================================================================
-- Tracks active user login sessions. Used for JWT token management,
-- multi-device login tracking, and forced logout functionality.
-- =============================================================================
CREATE TABLE IF NOT EXISTS login_sessions (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      TEXT            NOT NULL UNIQUE,    -- hashed JWT or session token
    device_info     TEXT,                               -- e.g., "Chrome on Mac", "iPhone 15"
    ip_address      INET,                               -- PostgreSQL native IP type
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    expires_at      TIMESTAMPTZ     NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    last_used_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  login_sessions               IS 'Active login sessions. One user can have multiple sessions (multi-device).';
COMMENT ON COLUMN login_sessions.user_id       IS 'FK → users.id. Cascades delete when user is removed.';
COMMENT ON COLUMN login_sessions.token_hash    IS 'SHA-256 hash of the JWT/session token. Never store raw tokens.';
COMMENT ON COLUMN login_sessions.ip_address    IS 'IP address of login origin. Uses PostgreSQL INET type.';
COMMENT ON COLUMN login_sessions.is_active     IS 'FALSE = session was explicitly logged out or expired.';
COMMENT ON COLUMN login_sessions.expires_at    IS 'Token expiry timestamp. Sessions past this time are invalid.';


-- =============================================================================
-- TABLE: audit_logs
-- =============================================================================
-- Immutable record of every significant action in the system.
-- Useful for compliance, security auditing, and debugging.
-- Rows should NEVER be updated or deleted — append-only.
-- =============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID            REFERENCES users(id) ON DELETE SET NULL,  -- NULL if action is system-generated
    action          VARCHAR(100)    NOT NULL,             -- e.g., 'USER_LOGIN', 'TRANSFER_INITIATED'
    entity_type     VARCHAR(50),                          -- e.g., 'transaction', 'account', 'user'
    entity_id       UUID,                                 -- ID of the affected record
    old_value       JSONB,                                -- snapshot before the change
    new_value       JSONB,                                -- snapshot after the change
    ip_address      INET,
    metadata        JSONB,                                -- any extra context (e.g., device, session_id)
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  audit_logs             IS 'Append-only log of all significant system events. Never update or delete rows.';
COMMENT ON COLUMN audit_logs.user_id     IS 'FK → users.id. NULL if the action was triggered by the system.';
COMMENT ON COLUMN audit_logs.action      IS 'Event name in SCREAMING_SNAKE_CASE, e.g., USER_LOGIN, TRANSFER_COMPLETED.';
COMMENT ON COLUMN audit_logs.entity_type IS 'The type of record affected, e.g., "transaction", "account".';
COMMENT ON COLUMN audit_logs.entity_id   IS 'UUID of the specific record that was affected.';
COMMENT ON COLUMN audit_logs.old_value   IS 'JSONB snapshot of the record before the change.';
COMMENT ON COLUMN audit_logs.new_value   IS 'JSONB snapshot of the record after the change.';
COMMENT ON COLUMN audit_logs.metadata    IS 'Extra context: device, browser, session ID, etc.';


-- =============================================================================
-- INDEXES
-- =============================================================================
-- Indexes speed up SELECT queries on frequently filtered/sorted columns.
-- Without indexes, PostgreSQL does a full table scan (slow at scale).
-- Naming convention: idx_<table>_<column(s)>
-- =============================================================================

-- users
CREATE INDEX IF NOT EXISTS idx_users_email       ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_active   ON users(is_active);

-- accounts
CREATE INDEX IF NOT EXISTS idx_accounts_user_id  ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_status   ON accounts(status);

-- transactions
CREATE INDEX IF NOT EXISTS idx_transactions_user_id         ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_from_account    ON transactions(from_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_to_account      ON transactions(to_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status          ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at      ON transactions(created_at DESC);

-- failed_transactions
CREATE INDEX IF NOT EXISTS idx_failed_txn_user_id       ON failed_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_failed_txn_attempted_at  ON failed_transactions(attempted_at DESC);

-- login_sessions
CREATE INDEX IF NOT EXISTS idx_login_sessions_user_id   ON login_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_login_sessions_is_active ON login_sessions(is_active);

-- audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id     ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action      ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity      ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at  ON audit_logs(created_at DESC);

-- beneficiaries
CREATE INDEX IF NOT EXISTS idx_beneficiaries_user_id  ON beneficiaries(user_id);
