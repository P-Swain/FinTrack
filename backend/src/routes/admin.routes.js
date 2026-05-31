import { Router } from "express";
import {
  getOverview,
  getFailedTransactions,
  getSuspiciousTransactions,
  getTopUsers,
  getAuditLogs,
} from "../controllers/admin.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/auth.middleware.js";

const router = Router();

// ── All admin routes: must be authenticated AND have ADMIN role ───────────────
router.use(authenticateToken);
router.use(authorizeRoles("ADMIN"));

// GET /api/admin/overview
router.get("/overview", getOverview);

// GET /api/admin/failed-transactions
router.get("/failed-transactions", getFailedTransactions);

// GET /api/admin/suspicious-transactions
router.get("/suspicious-transactions", getSuspiciousTransactions);

// GET /api/admin/top-users
router.get("/top-users", getTopUsers);

// GET /api/admin/audit-logs  — optional ?action=TRANSFER_COMPLETED filter
router.get("/audit-logs", getAuditLogs);

export default router;
