import { z } from "zod";

// ── Register Schema ───────────────────────────────────────────────────────────
export const registerSchema = z.object({
  full_name: z
    .string({ required_error: "full_name is required" })
    .trim()
    .min(2, "full_name must be at least 2 characters")
    .max(100, "full_name must be at most 100 characters"),

  email: z
    .string({ required_error: "email is required" })
    .email("Must be a valid email address")
    .trim()
    .toLowerCase(),

  password: z
    .string({ required_error: "password is required" })
    .min(8, "password must be at least 8 characters"),
});

// ── Login Schema ──────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z
    .string({ required_error: "email is required" })
    .email("Must be a valid email address")
    .trim()
    .toLowerCase(),

  password: z
    .string({ required_error: "password is required" })
    .min(1, "password is required"),
});
