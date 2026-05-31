/**
 * pages/Analytics.jsx
 *
 * Protected page — visualises transaction history as a monthly bar chart.
 *
 * Strategy (frontend-only aggregation):
 *   1. Fetch all transactions for the first account (up to limit=100 per page).
 *      We loop pages until we have exhausted the data or hit a 3-month window.
 *   2. Group by month ("May 2026") and transaction direction (credit vs debit).
 *   3. Feed the grouped data into a Recharts <BarChart>.
 *
 * This keeps the backend free of any reporting logic and demonstrates
 * data transformation on the frontend.
 */

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { getMyAccounts } from "../api/accounts.api";
import { getTransactionHistory } from "../api/transactions.api";
import { formatCurrency } from "../utils/formatCurrency";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import { BarChart3 } from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Returns "May 2026" for a date string */
function toMonthKey(dateString) {
  const d = new Date(dateString);
  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(d);
}

/**
 * Aggregates transactions into monthly credit / debit totals.
 * Returns an array sorted oldest → newest, e.g.:
 * [{ month: "Mar 2026", credit: 50000, debit: 12000 }, …]
 */
function aggregateByMonth(transactions) {
  const map = {}; // { "May 2026": { credit: 0, debit: 0 } }

  for (const tx of transactions) {
    const key = toMonthKey(tx.created_at);
    if (!map[key]) map[key] = { month: key, credit: 0, debit: 0 };

    const amount = parseFloat(tx.amount) || 0;
    if (tx.direction === "credit" || tx.transaction_type === "deposit") {
      map[key].credit += amount;
    } else {
      map[key].debit += amount;
    }
  }

  // Sort chronologically by parsing back to Date
  return Object.values(map).sort(
    (a, b) => new Date(a.month) - new Date(b.month)
  );
}

// ── Custom tooltip ─────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#1a1d2e] px-4 py-3 shadow-xl text-sm">
      <p className="font-semibold text-white mb-2">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.fill }} className="mb-0.5">
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Analytics() {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accountLabel, setAccountLabel] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      try {
        // Step 1: get the user's accounts
        const accountsData = await getMyAccounts();
        if (!accountsData.accounts.length) {
          setChartData([]);
          setLoading(false);
          return;
        }

        const firstAccount = accountsData.accounts[0];
        setAccountLabel(firstAccount.account_number);

        // Step 2: fetch up to 3 pages of 100 transactions (last ~300 entries)
        const allTransactions = [];
        const PAGE_LIMIT = 3;

        for (let page = 1; page <= PAGE_LIMIT; page++) {
          const data = await getTransactionHistory({
            account_number: firstAccount.account_number,
            limit: 100,
            page,
          });
          allTransactions.push(...data.transactions);
          if (page >= data.total_pages) break; // no more pages
        }

        // Step 3: aggregate into monthly buckets
        setChartData(aggregateByMonth(allTransactions));
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to load analytics data.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-indigo-400" />
          Analytics
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Monthly income vs spending for account ···{accountLabel.slice(-4) || "—"}
        </p>
      </div>

      {loading && <LoadingSpinner message="Crunching your data…" />}
      {!loading && error && <ErrorMessage message={error} />}

      {!loading && !error && chartData.length === 0 && (
        <div className="glass-card p-12 text-center text-slate-500">
          <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No transaction data available yet.</p>
          <p className="text-xs mt-1 text-slate-600">Make some transfers or deposits to see analytics.</p>
        </div>
      )}

      {!loading && !error && chartData.length > 0 && (
        <div className="glass-card p-6">
          <h2 className="text-sm font-medium text-slate-400 mb-6 uppercase tracking-wide">
            Monthly Credit vs Debit
          </h2>

          <ResponsiveContainer width="100%" height={350}>
            <BarChart
              data={chartData}
              margin={{ top: 0, right: 8, left: 8, bottom: 0 }}
              barGap={4}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fill: "#64748b", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Legend
                wrapperStyle={{ fontSize: "12px", color: "#94a3b8", paddingTop: "16px" }}
              />
              <Bar
                dataKey="credit"
                name="Credit (in)"
                fill="#34d399"
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
              />
              <Bar
                dataKey="debit"
                name="Debit (out)"
                fill="#f87171"
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
              />
            </BarChart>
          </ResponsiveContainer>

          {/* Summary cards */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              {
                label: "Total Credit",
                value: chartData.reduce((s, r) => s + r.credit, 0),
                color: "text-emerald-400",
              },
              {
                label: "Total Debit",
                value: chartData.reduce((s, r) => s + r.debit, 0),
                color: "text-red-400",
              },
              {
                label: "Net",
                value:
                  chartData.reduce((s, r) => s + r.credit, 0) -
                  chartData.reduce((s, r) => s + r.debit, 0),
                color: "text-indigo-400",
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl bg-white/4 border border-white/6 p-4">
                <p className="text-xs text-slate-500 mb-1">{label}</p>
                <p className={`text-lg font-semibold ${color}`}>
                  {formatCurrency(Math.abs(value))}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
