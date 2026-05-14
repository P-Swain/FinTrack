import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import authRoutes from "./routes/auth.routes.js";
import accountRoutes from "./routes/account.routes.js";

const app = express();

// ── Security & Logging Middleware ────────────────────────────────────────────
app.use(helmet());          // Sets secure HTTP response headers
app.use(cors());            // Enables Cross-Origin Resource Sharing
app.use(morgan("dev"));     // HTTP request logger (concise coloured output in dev)
app.use(express.json());    // Parses incoming JSON request bodies

// ── Health Check Route ───────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    message: "FinTrack backend is running",
  });
});

// ── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/accounts", accountRoutes);

// ── 404 Handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ status: "error", message: "Route not found" });
});

// ── Global Error Handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    status: "error",
    message: err.message || "Internal Server Error",
  });
});

export default app;
