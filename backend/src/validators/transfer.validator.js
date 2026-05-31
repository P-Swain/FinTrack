import { z } from "zod";

const ACCOUNT_NUMBER_REGEX = /^\d{12}$/;

// ── Transfer Schema ───────────────────────────────────────────────────────────
export const transferSchema = z
  .object({
    from_account_number: z
      .string({ required_error: "from_account_number is required" })
      .regex(ACCOUNT_NUMBER_REGEX, "from_account_number must be a 12-digit number"),

    to_account_number: z
      .string({ required_error: "to_account_number is required" })
      .regex(ACCOUNT_NUMBER_REGEX, "to_account_number must be a 12-digit number"),

    // z.coerce.number() accepts both numeric 1000 and string "1000" from Postman bodies
    amount: z.coerce
      .number({ required_error: "amount is required" })
      .positive("amount must be a positive number"),

    description: z
      .string()
      .max(255, "description must be at most 255 characters")
      .optional(),

    idempotency_key: z
      .string({ required_error: "idempotency_key is required" })
      .uuid("idempotency_key must be a valid UUID"),
  })
  // Cross-field refinement: sender and receiver must be different accounts
  .refine((data) => data.from_account_number !== data.to_account_number, {
    message: "from_account_number and to_account_number must not be the same",
    path: ["to_account_number"],
  });
