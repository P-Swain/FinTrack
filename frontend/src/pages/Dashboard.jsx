/**
 * pages/Dashboard.jsx
 *
 * Protected page — visible only to authenticated users.
 *
 * What it shows:
 *   - A greeting with the user's name
 *   - All of the user's accounts as AccountCards
 *   - Recent transactions for the currently selected account
 *
 * API calls:
 *   GET /api/accounts                → accounts list
 *   GET /api/transactions?account_number=&limit=5
 *     ↑ Uses account_number (12-digit string), NOT account_id or account UUID.
 *       This is required by the backend (transaction.controller.js line 198).
 */

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { getMyAccounts } from "../api/accounts.api";
import { getTransactionHistory } from "../api/transactions.api";
import AccountCard from "../components/AccountCard";
import TransactionTable from "../components/TransactionTable";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import { Sparkles, RefreshCw } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();

  // ── Accounts state ────────────────────────────────────────────────────────
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState("");

  // ── Selected account + its transactions ──────────────────────────────────
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState("");

  // ── Fetch accounts on mount ───────────────────────────────────────────────
  useEffect(() => {
    async function loadAccounts() {
      setAccountsLoading(true);
      setAccountsError("");
      try {
        const data = await getMyAccounts();
        setAccounts(data.accounts);
        // Auto-select the first account so transactions load immediately
        if (data.accounts.length > 0) {
          setSelectedAccount(data.accounts[0]);
        }
      } catch (err) {
        setAccountsError(
          err?.response?.data?.message || "Failed to load accounts."
        );
      } finally {
        setAccountsLoading(false);
      }
    }
    loadAccounts();
  }, []);

  // ── Fetch recent transactions when selected account changes ───────────────
  const loadTransactions = useCallback(async (account) => {
    if (!account) return;
    setTxLoading(true);
    setTxError("");
    try {
      // account_number is the 12-digit string — required by the backend
      const data = await getTransactionHistory({
        account_number: account.account_number,
        limit: 5,
        page: 1,
      });
      setTransactions(data.transactions);
    } catch (err) {
      setTxError(
        err?.response?.data?.message || "Failed to load transactions."
      );
    } finally {
      setTxLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransactions(selectedAccount);
  }, [selectedAccount, loadTransactions]);

  // ── Derived totals (for the summary row) ─────────────────────────────────
  const totalBalance = accounts.reduce((sum, a) => sum + parseFloat(a.balance || 0), 0);
  const activeAccounts = accounts.filter((a) => a.status === "active").length;

  return (
    <div className="animate-fade-in space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-5 w-5 text-indigo-400" />
            <h1 className="text-2xl font-bold text-white">
              Hello, {user?.full_name?.split(" ")[0] ?? "there"} 👋
            </h1>
          </div>
          <p className="text-slate-400 text-sm">Here's your financial overview</p>
        </div>

        {/* Quick stats */}
        <div className="hidden sm:flex items-center gap-6 text-right">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Accounts</p>
            <p className="text-xl font-semibold text-white">{accounts.length}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Active</p>
            <p className="text-xl font-semibold text-emerald-400">{activeAccounts}</p>
          </div>
        </div>
      </div>

      {/* Accounts section */}
      <section>
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-4">
          Your Accounts
        </h2>

        {accountsLoading && <LoadingSpinner message="Loading accounts…" />}
        {!accountsLoading && accountsError && (
          <ErrorMessage message={accountsError} onDismiss={() => setAccountsError("")} />
        )}

        {!accountsLoading && !accountsError && accounts.length === 0 && (
          <div className="glass-card p-8 text-center text-slate-500">
            <p className="text-sm">You don't have any accounts yet.</p>
          </div>
        )}

        {!accountsLoading && accounts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                isSelected={selectedAccount?.id === account.id}
                onClick={() => setSelectedAccount(account)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Recent Transactions section */}
      {selectedAccount && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide">
                Recent Transactions
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Account ···{selectedAccount.account_number.slice(-4)}
              </p>
            </div>
            <button
              id="refresh-transactions"
              onClick={() => loadTransactions(selectedAccount)}
              disabled={txLoading}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-40"
              aria-label="Refresh transactions"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${txLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          <div className="glass-card p-5">
            {txLoading && <LoadingSpinner size="sm" message="Loading transactions…" />}
            {!txLoading && txError && (
              <ErrorMessage message={txError} onDismiss={() => setTxError("")} />
            )}
            {!txLoading && !txError && (
              <TransactionTable transactions={transactions} compact />
            )}
          </div>
        </section>
      )}
    </div>
  );
}
