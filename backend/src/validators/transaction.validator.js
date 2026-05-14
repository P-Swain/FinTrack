import { z } from "zod";

// Shared fields for both deposit and withdraw
const baseTransactionSchema = z.object({
  account_id: z
    .string({ required_error: "account_id is required" })
    .uuid("account_id must be a valid UUID"),

  // z.coerce.number() accepts both numeric 500 and string "500" from Postman form bodies
  amount: z.coerce
    .number({ required_error: "amount is required" })
    .positive("amount must be a positive number"),

  description: z
    .string()
    .max(255, "description must be at most 255 characters")
    .optional(),
});

// ── Deposit Schema ────────────────────────────────────────────────────────────
export const depositSchema = baseTransactionSchema;

// ── Withdraw Schema ───────────────────────────────────────────────────────────
export const withdrawSchema = baseTransactionSchema;
