import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";

// ── POST /api/auth/register ───────────────────────────────────────────────────
export const register = async (req, res, next) => {
  try {
    const { full_name, email, password } = req.body;

    // 1. Check for duplicate email
    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ message: "Email already registered" });
    }

    // 2. Hash password
    const password_hash = await bcrypt.hash(password, 12);

    // 3. Insert new user — role defaults to 'USER' at the DB level
    const { rows } = await pool.query(
      `INSERT INTO users (full_name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, full_name, email, role, created_at`,
      [full_name, email, password_hash]
    );

    const user = rows[0];

    // 4. Return safe user object (no password_hash)
    return res.status(201).json({
      message: "User registered successfully",
      user: {
        id:         user.id,
        full_name:  user.full_name,
        email:      user.email,
        role:       user.role,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/auth/login ──────────────────────────────────────────────────────
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Find user by email — select only what we need
    const { rows } = await pool.query(
      `SELECT id, full_name, email, password_hash, role, created_at
       FROM users
       WHERE email = $1`,
      [email]
    );

    const user = rows[0];

    // 2. Generic error — do NOT reveal whether email or password was wrong
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // 3. Compare plaintext password against stored hash
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // 4. Issue JWT — embed the real role from the DB row
    const payload = { id: user.id, email: user.email, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    });

    // 5. Respond — never include password_hash
    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id:         user.id,
        full_name:  user.full_name,
        email:      user.email,
        role:       user.role,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
export const getMe = (_req, res) => {
  // req.user is populated by authenticateToken middleware
  res.status(200).json({ user: _req.user });
};
