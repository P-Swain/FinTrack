/**
 * pages/AdminDashboard.jsx
 *
 * Protected page — accessible only when user.role === "ADMIN".
 * ProtectedRoute with role="ADMIN" prevents regular users from reaching this page.
 *
 * What it loads (all 5 admin endpoints verified from admin.routes.js):
 *   GET /api/admin/overview                → stats cards
 *   GET /api/admin/failed-transactions     → table
 *   GET /api/admin/suspicious-transactions → table
 *   GET /api/admin/top-users               → table
 *   GET /api/admin/audit-logs              → table
 *
 * Resilience strategy:
 *   We use Promise.allSettled() so that if any endpoint fails (e.g. the DB
 *   doesn't have the table yet), only that section shows an error and the rest
 *   still render.  This prevents the whole page from crashing.
 */

import { useState, useEffect } from "react";
import {
  getOverview,
  getFailedTransactions,
  getSuspiciousTransactions,
  getTopUsers,
  getAuditLogs,
} from "../api/admin.api";
import { formatCurrency } from "../utils/formatCurrency";
import { formatDate } from "../utils/formatDate";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import {
  ShieldCheck,
  Users,
  Landmark,
  Activity,
  AlertTriangle,
  XCircle,
  Eye,
  ScrollText,
} from "lucide-react";

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color = "text-indigo-400", bg = "bg-indigo-500/10" }) {
  return (
    <div className="glass-card p-5 flex items-center gap-4">
      <div className={`rounded-xl p-3 ${bg}`}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value ?? "—"}</p>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="h-5 w-5 text-indigo-400" />
      <h2 className="text-base font-semibold text-white">{title}</h2>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);

  // Each section has its own data + error so one failure doesn't cascade
  const [overview, setOverview]   = useState(null);
  const [overviewError, setOverviewError]   = useState("");

  const [failedTx, setFailedTx]   = useState([]);
  const [failedError, setFailedError]   = useState("");

  const [suspiciousTx, setSuspiciousTx]   = useState([]);
  const [suspiciousError, setSuspiciousError]   = useState("");

  const [topUsers, setTopUsers]   = useState([]);
  const [topUsersError, setTopUsersError]   = useState("");

  const [auditLogs, setAuditLogs]   = useState([]);
  const [auditError, setAuditError]   = useState("");

  useEffect(() => {
    async function loadAll() {
      setLoading(true);

      // allSettled: every promise resolves even if some reject
      const [
        overviewRes,
        failedRes,
        suspiciousRes,
        topUsersRes,
        auditRes,
      ] = await Promise.allSettled([
        getOverview(),
        getFailedTransactions({ limit: 10 }),
        getSuspiciousTransactions({ limit: 10 }),
        getTopUsers({ limit: 10 }),
        getAuditLogs({ limit: 15 }),
      ]);

      // Overview
      if (overviewRes.status === "fulfilled") {
        setOverview(overviewRes.value);
      } else {
        setOverviewError(
          overviewRes.reason?.response?.data?.message || "Could not load overview stats."
        );
      }

      // Failed transactions
      if (failedRes.status === "fulfilled") {
        setFailedTx(failedRes.value.failed_transactions ?? []);
      } else {
        setFailedError(
          failedRes.reason?.response?.data?.message || "Could not load failed transactions."
        );
      }

      // Suspicious transactions
      if (suspiciousRes.status === "fulfilled") {
        setSuspiciousTx(suspiciousRes.value.suspicious_transactions ?? []);
      } else {
        setSuspiciousError(
          suspiciousRes.reason?.response?.data?.message || "Could not load suspicious transactions."
        );
      }

      // Top users
      if (topUsersRes.status === "fulfilled") {
        setTopUsers(topUsersRes.value.top_users ?? []);
      } else {
        setTopUsersError(
          topUsersRes.reason?.response?.data?.message || "Could not load top users."
        );
      }

      // Audit logs
      if (auditRes.status === "fulfilled") {
        setAuditLogs(auditRes.value.audit_logs ?? []);
      } else {
        setAuditError(
          auditRes.reason?.response?.data?.message || "Could not load audit logs."
        );
      }

      setLoading(false);
    }

    loadAll();
  }, []);

  if (loading) {
    return <LoadingSpinner message="Loading admin data…" />;
  }

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-violet-500/20 p-2">
          <ShieldCheck className="h-6 w-6 text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-slate-400 text-sm">Platform-wide overview and monitoring</p>
        </div>
      </div>

      {/* ── Overview Stats ──────────────────────────────────────────────────── */}
      {overviewError ? (
        <ErrorMessage message={overviewError} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard icon={Users}    label="Users"            value={overview?.total_users} />
          <StatCard icon={Landmark} label="Accounts"         value={overview?.total_accounts}
            color="text-sky-400" bg="bg-sky-500/10" />
          <StatCard icon={Activity} label="Completed Tx"     value={overview?.total_completed_transactions}
            color="text-emerald-400" bg="bg-emerald-500/10" />
          <StatCard icon={Activity} label="Volume"
            value={formatCurrency(overview?.total_completed_volume ?? 0)}
            color="text-emerald-400" bg="bg-emerald-500/10" />
          <StatCard icon={XCircle}  label="Failed Tx"        value={overview?.failed_transaction_count}
            color="text-red-400" bg="bg-red-500/10" />
          <StatCard icon={AlertTriangle} label="Suspicious"  value={overview?.suspicious_transfer_count}
            color="text-amber-400" bg="bg-amber-500/10" />
        </div>
      )}

      {/* ── Failed Transactions ─────────────────────────────────────────────── */}
      <section className="glass-card p-6">
        <SectionHeader icon={XCircle} title="Recent Failed Transactions" />
        {failedError ? (
          <ErrorMessage message={failedError} />
        ) : failedTx.length === 0 ? (
          <p className="text-sm text-slate-500">No failed transactions.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-xs text-slate-500 uppercase tracking-wide text-left">
                  <th className="pb-3 pr-4">User</th>
                  <th className="pb-3 pr-4">From → To</th>
                  <th className="pb-3 pr-4">Amount</th>
                  <th className="pb-3 pr-4">Reason</th>
                  <th className="pb-3">Attempted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {failedTx.map((ft) => (
                  <tr key={ft.id} className="hover:bg-white/3 transition-colors">
                    <td className="py-3 pr-4">
                      <p className="text-white text-xs">{ft.user_full_name}</p>
                      <p className="text-slate-500 text-xs">{ft.user_email}</p>
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-slate-400">
                      {ft.from_account_number ?? "—"} → {ft.to_account_number ?? "—"}
                    </td>
                    <td className="py-3 pr-4 text-red-400 font-medium">
                      {formatCurrency(ft.amount, ft.currency)}
                    </td>
                    <td className="py-3 pr-4 text-xs text-slate-400 max-w-[200px] truncate">
                      {ft.failure_reason ?? "—"}
                    </td>
                    <td className="py-3 text-xs text-slate-500">
                      {formatDate(ft.attempted_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Suspicious Transactions ─────────────────────────────────────────── */}
      <section className="glass-card p-6">
        <SectionHeader icon={AlertTriangle} title="Suspicious Transactions (≥ ₹50,000)" />
        {suspiciousError ? (
          <ErrorMessage message={suspiciousError} />
        ) : suspiciousTx.length === 0 ? (
          <p className="text-sm text-slate-500">No suspicious transactions detected.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-xs text-slate-500 uppercase tracking-wide text-left">
                  <th className="pb-3 pr-4">User</th>
                  <th className="pb-3 pr-4">From → To</th>
                  <th className="pb-3 pr-4">Amount</th>
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {suspiciousTx.map((tx) => (
                  <tr key={tx.id} className="hover:bg-white/3 transition-colors">
                    <td className="py-3 pr-4">
                      <p className="text-white text-xs">{tx.user_full_name}</p>
                      <p className="text-slate-500 text-xs">{tx.user_email}</p>
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-slate-400">
                      {tx.from_account_number ?? "—"} → {tx.to_account_number ?? "—"}
                    </td>
                    <td className="py-3 pr-4 text-amber-400 font-semibold">
                      {formatCurrency(tx.amount, tx.currency)}
                    </td>
                    <td className="py-3 pr-4 capitalize text-slate-300 text-xs">
                      {tx.transaction_type}
                    </td>
                    <td className="py-3 text-xs text-slate-500">
                      {formatDate(tx.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Top Users ───────────────────────────────────────────────────────── */}
      <section className="glass-card p-6">
        <SectionHeader icon={Users} title="Top Users by Volume" />
        {topUsersError ? (
          <ErrorMessage message={topUsersError} />
        ) : topUsers.length === 0 ? (
          <p className="text-sm text-slate-500">No data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-xs text-slate-500 uppercase tracking-wide text-left">
                  <th className="pb-3 pr-4">#</th>
                  <th className="pb-3 pr-4">User</th>
                  <th className="pb-3 pr-4">Transactions</th>
                  <th className="pb-3">Total Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {topUsers.map((u, i) => (
                  <tr key={u.id} className="hover:bg-white/3 transition-colors">
                    <td className="py-3 pr-4 text-slate-500 font-mono text-xs">
                      {i + 1}
                    </td>
                    <td className="py-3 pr-4">
                      <p className="text-white text-xs">{u.full_name}</p>
                      <p className="text-slate-500 text-xs">{u.email}</p>
                    </td>
                    <td className="py-3 pr-4 text-indigo-400 font-medium">
                      {u.transaction_count}
                    </td>
                    <td className="py-3 text-emerald-400 font-semibold">
                      {formatCurrency(u.total_volume)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Audit Logs ──────────────────────────────────────────────────────── */}
      <section className="glass-card p-6">
        <SectionHeader icon={ScrollText} title="Recent Audit Logs" />
        {auditError ? (
          <ErrorMessage message={auditError} />
        ) : auditLogs.length === 0 ? (
          <p className="text-sm text-slate-500">No audit log entries.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-xs text-slate-500 uppercase tracking-wide text-left">
                  <th className="pb-3 pr-4">Action</th>
                  <th className="pb-3 pr-4">Entity</th>
                  <th className="pb-3 pr-4">User</th>
                  <th className="pb-3 pr-4">IP</th>
                  <th className="pb-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/3 transition-colors">
                    <td className="py-3 pr-4">
                      <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-400">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-xs text-slate-400 capitalize">
                      {log.entity_type}
                    </td>
                    <td className="py-3 pr-4">
                      <p className="text-white text-xs">{log.user_full_name ?? "—"}</p>
                      <p className="text-slate-500 text-xs">{log.user_email ?? ""}</p>
                    </td>
                    <td className="py-3 pr-4 text-xs font-mono text-slate-500">
                      {log.ip_address ?? "—"}
                    </td>
                    <td className="py-3 text-xs text-slate-500">
                      {formatDate(log.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
