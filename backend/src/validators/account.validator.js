import { z } from "zod";

const ACCOUNT_TYPES = ["savings", "checking", "wallet"];

// ── Create Account Schema ─────────────────────────────────────────────────────
export const createAccountSchema = z.object({
  account_type: z.enum(ACCOUNT_TYPES, {
    error: `account_type must be one of: ${ACCOUNT_TYPES.join(", ")}`,
  }),
});
