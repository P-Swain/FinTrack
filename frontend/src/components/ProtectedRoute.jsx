/**
 * components/ProtectedRoute.jsx
 *
 * Guards routes based on authentication status and optional role.
 *
 * Usage:
 *   <ProtectedRoute>           — blocks unauthenticated users → /login
 *   <ProtectedRoute publicOnly>— blocks authenticated users   → /dashboard
 *   <ProtectedRoute role="ADMIN"> — blocks non-admin users    → /dashboard
 *
 * How it works:
 *   isAuthenticated comes from AuthContext (memory-only JWT).
 *   A page refresh clears the token, so the user is correctly redirected to /login.
 */

import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * @param {object}  props
 * @param {boolean} [props.publicOnly]  If true, authenticated users are redirected to /dashboard.
 * @param {string}  [props.role]        If set, user.role must match this value or user is redirected.
 */
export default function ProtectedRoute({ publicOnly = false, role }) {
  const { isAuthenticated, user } = useAuth();

  // Public-only pages (Login, Register): logged-in users go to the dashboard
  if (publicOnly && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  // Protected pages: unauthenticated users go to the login page
  if (!publicOnly && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Role-restricted pages (e.g., Admin): redirect non-matching users to dashboard
  if (role && user?.role !== role) {
    return <Navigate to="/dashboard" replace />;
  }

  // All checks passed — render the child route
  return <Outlet />;
}
