/**
 * App.jsx
 *
 * Defines the full client-side routing tree.
 *
 * Route structure:
 *   /              → redirect to /dashboard
 *   /login         → public only (authenticated → /dashboard)
 *   /register      → public only (authenticated → /dashboard)
 *
 *   ── Protected (authenticated users only) ──
 *   /dashboard     → Dashboard
 *   /transfer      → Transfer
 *   /transactions  → Transactions
 *   /analytics     → Analytics
 *
 *   ── Admin only ──
 *   /admin         → AdminDashboard (role="ADMIN")
 *
 * Layout wraps all protected pages with <Navbar> + <main>.
 * ProtectedRoute handles all redirect logic — no duplicate auth checks in pages.
 */

import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout        from "./components/Layout";

import Login          from "./pages/Login";
import Register       from "./pages/Register";
import Dashboard      from "./pages/Dashboard";
import Transfer       from "./pages/Transfer";
import Transactions   from "./pages/Transactions";
import Analytics      from "./pages/Analytics";
import AdminDashboard from "./pages/AdminDashboard";

export default function App() {
  return (
    <Routes>
      {/* ── Root redirect ────────────────────────────────────────────────── */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* ── Public routes (logged-in users bounce to /dashboard) ─────────── */}
      <Route element={<ProtectedRoute publicOnly />}>
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      {/* ── Protected routes (unauthenticated users bounce to /login) ─────── */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard"    element={<Dashboard />} />
          <Route path="/transfer"     element={<Transfer />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/analytics"    element={<Analytics />} />
        </Route>
      </Route>

      {/* ── Admin-only route ─────────────────────────────────────────────── */}
      <Route element={<ProtectedRoute role="ADMIN" />}>
        <Route element={<Layout />}>
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>
      </Route>

      {/* ── 404 fallback ─────────────────────────────────────────────────── */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
