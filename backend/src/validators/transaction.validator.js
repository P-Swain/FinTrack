import { z } from "zod";

// Shared fields for both deposit and withdraw
const baseTransactionSchema = z.object({
  // External API now accepts account_number, not the internal UUID.
  // 12-digit string validated with a regex — rejects anything that isn't exactly 12 digits.
  account_number: z
    .string({ required_error: "account_number is required" })
    .regex(/^\d{12}$/, "account_number must be a 12-digit number"),

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
