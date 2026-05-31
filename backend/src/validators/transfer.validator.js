import { z } from "zod";

// ── Transfer Schema ───────────────────────────────────────────────────────────
export const transferSchema = z
  .object({
    from_account_id: z
      .string({ required_error: "from_account_id is required" })
      .uuid("from_account_id must be a valid UUID"),

    to_account_id: z
      .string({ required_error: "to_account_id is required" })
      .uuid("to_account_id must be a valid UUID"),

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
  .refine((data) => data.from_account_id !== data.to_account_id, {
    message: "from_account_id and to_account_id must not be the same",
    path: ["to_account_id"],
  });
