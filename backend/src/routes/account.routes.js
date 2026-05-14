import { Router } from "express";
import { createAccount, getMyAccounts, getAccountById, getAccountByNumber } from "../controllers/account.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { createAccountSchema } from "../validators/account.validator.js";

const router = Router();

// ── All account routes require a valid JWT ────────────────────────────────────
router.use(authenticateToken);

// POST /api/accounts — create a new account
router.post("/", validate(createAccountSchema), createAccount);

// GET /api/accounts — list all accounts owned by the authenticated user
router.get("/", getMyAccounts);

// GET /api/accounts/number/:account_number — look up by human-readable account number
// Must be registered BEFORE /:id, otherwise Express treats "number" as an :id value
router.get("/number/:account_number", getAccountByNumber);

// GET /api/accounts/:id — get a single account by internal UUID (ownership enforced in controller)
router.get("/:id", getAccountById);

export default router;
