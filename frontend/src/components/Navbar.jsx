/**
 * components/Navbar.jsx
 *
 * Top navigation bar shown on all protected pages (inside Layout).
 * - Shows nav links: Dashboard, Transfer, Transactions, Analytics
 * - Shows "Admin" link only when user.role === "ADMIN"
 * - Shows logged-in user's name and a Logout button
 */

import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  ArrowLeftRight,
  ListOrdered,
  BarChart3,
  ShieldCheck,
  LogOut,
  TrendingUp,
} from "lucide-react";

// ── Nav link helper ───────────────────────────────────────────────────────────
function NavItem({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
          isActive
            ? "bg-indigo-500/20 text-indigo-400"
            : "text-slate-400 hover:text-slate-200 hover:bg-white/6"
        }`
      }
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </NavLink>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-white/8 bg-[#0f1117]/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="rounded-xl bg-indigo-500/20 p-1.5">
              <TrendingUp className="h-5 w-5 text-indigo-400" />
            </div>
            <span className="text-lg font-semibold text-white">FinTrack</span>
          </div>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-1">
            <NavItem to="/dashboard"    icon={LayoutDashboard} label="Dashboard" />
            <NavItem to="/transfer"     icon={ArrowLeftRight}  label="Transfer" />
            <NavItem to="/transactions" icon={ListOrdered}     label="Transactions" />
            <NavItem to="/analytics"   icon={BarChart3}        label="Analytics" />
            {user?.role === "ADMIN" && (
              <NavItem to="/admin" icon={ShieldCheck} label="Admin" />
            )}
          </div>

          {/* User info + logout */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-white leading-none">
                {user?.full_name ?? "User"}
              </p>
              <p className="text-xs text-slate-500 mt-0.5 capitalize">
                {user?.role?.toLowerCase() ?? ""}
              </p>
            </div>

            <button
              id="logout-button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-400 hover:border-red-500/40 hover:text-red-400 transition-all duration-150"
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Mobile nav — shown below md breakpoint */}
        <div className="flex md:hidden gap-1 pb-2 overflow-x-auto">
          <NavItem to="/dashboard"    icon={LayoutDashboard} label="Dashboard" />
          <NavItem to="/transfer"     icon={ArrowLeftRight}  label="Transfer" />
          <NavItem to="/transactions" icon={ListOrdered}     label="Transactions" />
          <NavItem to="/analytics"   icon={BarChart3}        label="Analytics" />
          {user?.role === "ADMIN" && (
            <NavItem to="/admin" icon={ShieldCheck} label="Admin" />
          )}
        </div>
      </div>
    </nav>
  );
}
