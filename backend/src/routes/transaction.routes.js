import { Router } from "express";
import { deposit, withdraw, getTransactionHistory } from "../controllers/transaction.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { depositSchema, withdrawSchema } from "../validators/transaction.validator.js";

const router = Router();

// ── All transaction routes require a valid JWT ────────────────────────────────
router.use(authenticateToken);

// GET /api/transactions — paginated transaction history for a given account_number
router.get("/", getTransactionHistory);

// POST /api/transactions/deposit
router.post("/deposit", validate(depositSchema), deposit);

// POST /api/transactions/withdraw
router.post("/withdraw", validate(withdrawSchema), withdraw);

export default router;

