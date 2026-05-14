import jwt from "jsonwebtoken";

// ── authenticateToken ─────────────────────────────────────────────────────────
// Protects routes by verifying the Bearer JWT in the Authorization header.
// On success  → attaches the decoded payload to req.user and calls next().
// On failure  → returns 401 with a descriptive message.
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Authorization header missing" });
  }

  const parts = authHeader.split(" ");

  if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
    return res.status(401).json({ message: "Bearer token missing" });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

// ── authorizeRoles ────────────────────────────────────────────────────────────
// Role-based access control. Use after authenticateToken.
// Example: router.get("/admin", authenticateToken, authorizeRoles("ADMIN"), handler)
export const authorizeRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ message: "Access denied" });
  }
  next();
};
