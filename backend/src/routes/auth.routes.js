import { Router } from "express";
import { register, login, getMe } from "../controllers/auth.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { registerSchema, loginSchema } from "../validators/auth.validator.js";

const router = Router();

// POST /api/auth/register
router.post("/register", validate(registerSchema), register);

// POST /api/auth/login
router.post("/login", validate(loginSchema), login);

// GET /api/auth/me  — protected
router.get("/me", authenticateToken, getMe);

export default router;
