import { Router } from "express";
import { transferFundsController } from "../controllers/transfer.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { transferSchema } from "../validators/transfer.validator.js";

const router = Router();

// ── POST /api/transfers ───────────────────────────────────────────────────────
// 1. authenticateToken  — verifies JWT, attaches req.user
// 2. validate           — runs Zod schema, rejects early with 400 if invalid
// 3. transferFundsController — executes ACID transfer via service layer
router.post("/", authenticateToken, validate(transferSchema), transferFundsController);

export default router;
