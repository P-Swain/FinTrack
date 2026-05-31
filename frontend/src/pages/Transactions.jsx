/**
 * pages/Transactions.jsx
 *
 * Protected page — shows paginated, filtered transaction history.
 *
 * API:
 *   GET /api/accounts  → populate account selector
 *   GET /api/transactions?account_number=&transaction_type=&from_date=&to_date=&page=&limit=
 *     ↑ All filter params verified from transaction.controller.js
 *       account_number is REQUIRED (12-digit string)
 *
 * Filters:
 *   - account (dropdown from user's accounts)
 *   - transaction_type: deposit | withdrawal | transfer | refund
 *   - from_date / to_date (ISO date)
 *   - page / limit
 */

import { useState, useEffect, useCallback } from "react";
import { getMyAccounts } from "../api/accounts.api";
import { getTransactionHistory } from "../api/transactions.api";
import TransactionTable from "../components/TransactionTable";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import { ListOrdered, ChevronLeft, ChevronRight, Search } from "lucide-react";

const TRANSACTION_TYPES = ["", "deposit", "withdrawal", "transfer", "refund"];
const LIMITS = [10, 25, 50];

export default function Transactions() {
  // ── Accounts ──────────────────────────────────────────────────────────────
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState({
    account_number: "",    // populated after accounts load
    transaction_type: "",
    from_date: "",
    to_date: "",
    page: 1,
    limit: 10,
  });

  // ── Results ───────────────────────────────────────────────────────────────
  const [transactions, setTransactions] = useState([]);
  const [meta, setMeta] = useState({ total: 0, total_pages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Load accounts on mount ────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const data = await getMyAccounts();
        setAccounts(data.accounts);
        if (data.accounts.length > 0) {
          setFilters((prev) => ({
            ...prev,
            account_number: data.accounts[0].account_number,
          }));
        }
      } catch {
        // silently ignore — the account selector will just be empty
      } finally {
        setAccountsLoading(false);
      }
    }
    load();
  }, []);

  // ── Fetch transactions when filters change ────────────────────────────────
  const fetchTransactions = useCallback(async () => {
    if (!filters.account_number) return; // backend requires this field
    setLoading(true);
    setError("");
    try {
      const data = await getTransactionHistory(filters);
      setTransactions(data.transactions);
      setMeta({ total: data.total, total_pages: data.total_pages });
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load transactions.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleFilterChange(e) {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value, page: 1 })); // reset to page 1
  }

  function handlePage(delta) {
    setFilters((prev) => ({
      ...prev,
      page: Math.max(1, Math.min(meta.total_pages, prev.page + delta)),
    }));
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ListOrdered className="h-6 w-6 text-indigo-400" />
          Transaction History
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Browse and filter all your account activity.
        </p>
      </div>

      {/* Filter bar */}
      <div className="glass-card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">

          {/* Account selector */}
          <div>
            <label htmlFor="tx-account" className="block text-xs text-slate-500 mb-1">Account</label>
            <select
              id="tx-account"
              name="account_number"
              value={filters.account_number}
              onChange={handleFilterChange}
              disabled={accountsLoading}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 transition-all"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.account_number} className="bg-[#1a1d2e]">
                  ···{a.account_number.slice(-4)} ({a.account_type})
                </option>
              ))}
            </select>
          </div>

          {/* Transaction type */}
          <div>
            <label htmlFor="tx-type" className="block text-xs text-slate-500 mb-1">Type</label>
            <select
              id="tx-type"
              name="transaction_type"
              value={filters.transaction_type}
              onChange={handleFilterChange}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 transition-all capitalize"
            >
              {TRANSACTION_TYPES.map((t) => (
                <option key={t} value={t} className="bg-[#1a1d2e] capitalize">
                  {t || "All types"}
                </option>
              ))}
            </select>
          </div>

          {/* From date */}
          <div>
            <label htmlFor="tx-from-date" className="block text-xs text-slate-500 mb-1">From date</label>
            <input
              id="tx-from-date"
              name="from_date"
              type="date"
              value={filters.from_date}
              onChange={handleFilterChange}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 transition-all"
            />
          </div>

          {/* To date */}
          <div>
            <label htmlFor="tx-to-date" className="block text-xs text-slate-500 mb-1">To date</label>
            <input
              id="tx-to-date"
              name="to_date"
              type="date"
              value={filters.to_date}
              onChange={handleFilterChange}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 transition-all"
            />
          </div>

          {/* Limit per page */}
          <div>
            <label htmlFor="tx-limit" className="block text-xs text-slate-500 mb-1">Per page</label>
            <select
              id="tx-limit"
              name="limit"
              value={filters.limit}
              onChange={handleFilterChange}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 transition-all"
            >
              {LIMITS.map((l) => (
                <option key={l} value={l} className="bg-[#1a1d2e]">{l} rows</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="glass-card p-5">
        {loading && <LoadingSpinner message="Loading transactions…" />}
        {!loading && error && (
          <ErrorMessage message={error} onDismiss={() => setError("")} />
        )}
        {!loading && !error && (
          <>
            {/* Meta info */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-slate-500">
                {meta.total === 0
                  ? "No transactions found"
                  : `Showing ${(filters.page - 1) * filters.limit + 1}–${Math.min(
                      filters.page * filters.limit,
                      meta.total
                    )} of ${meta.total}`}
              </p>
              {meta.total > 0 && (
                <div className="flex items-center gap-1">
                  <button
                    id="tx-prev-page"
                    onClick={() => handlePage(-1)}
                    disabled={filters.page <= 1}
                    className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/8 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs text-slate-400 px-2">
                    {filters.page} / {meta.total_pages}
                  </span>
                  <button
                    id="tx-next-page"
                    onClick={() => handlePage(1)}
                    disabled={filters.page >= meta.total_pages}
                    className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/8 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <TransactionTable transactions={transactions} />
          </>
        )}
      </div>
    </div>
  );
}
