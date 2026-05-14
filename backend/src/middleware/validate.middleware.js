// ── Validation Middleware ─────────────────────────────────────────────────────
// Wraps a Zod schema and validates req.body before the request reaches the controller.
// On success  → replaces req.body with the parsed (and transformed) data, then calls next().
// On failure  → returns 400 with a readable list of field errors.

/**
 * @param {import("zod").ZodSchema} schema
 */
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.issues.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));

    return res.status(400).json({
      message: "Validation failed",
      errors,
    });
  }

  // Replace body with the parsed & transformed data, for example lowercased email
  req.body = result.data;
  next();
};