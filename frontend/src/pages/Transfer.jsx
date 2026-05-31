/**
 * pages/Transfer.jsx
 *
 * Protected page — lets the user transfer funds between accounts.
 *
 * API calls:
 *   GET  /api/accounts   → populate the "From account" dropdown
 *   POST /api/transfers  → { from_account_number, to_account_number,
 *                             amount, description, idempotency_key }
 *
 * Idempotency key design:
 *   - Generated with crypto.randomUUID() using a useRef on first render.
 *   - useRef means the value persists across re-renders without triggering them.
 *   - After a SUCCESSFUL transfer, we generate a NEW key for the next transfer.
 *   - We do NOT regenerate on every render (that would break idempotency).
 */

import { useState, useEffect, useRef } from "react";
import { getMyAccounts } from "../api/accounts.api";
import { transferFunds } from "../api/transfer.api";
import { formatCurrency } from "../utils/formatCurrency";
import ErrorMessage from "../components/ErrorMessage";
import LoadingSpinner from "../components/LoadingSpinner";
import { ArrowLeftRight, CheckCircle2, AlertTriangle } from "lucide-react";

export default function Transfer() {
  // ── Accounts (for the "From" dropdown) ───────────────────────────────────
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState("");

  // ── Form state ────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    from_account_number: "",
    to_account_number: "",
    amount: "",
    description: "",
  });

  // ── Idempotency key — useRef so it survives re-renders ────────────────────
  const idempotencyKeyRef = useRef(crypto.randomUUID());

  // ── Submission state ──────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // the returned transaction on success

  // ── Load accounts on mount ────────────────────────────────────────────────
  useEffect(() => {
    async function loadAccounts() {
      try {
        const data = await getMyAccounts();
        setAccounts(data.accounts);
        // Pre-select the first active account
        const firstActive = data.accounts.find((a) => a.status === "active");
        if (firstActive) {
          setForm((prev) => ({
            ...prev,
            from_account_number: firstActive.account_number,
          }));
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

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
    setResult(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setResult(null);

    // Basic client-side guard
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid amount greater than 0.");
      return;
    }
    if (!/^\d{12}$/.test(form.to_account_number)) {
      setError("Recipient account number must be exactly 12 digits.");
      return;
    }
    if (form.from_account_number === form.to_account_number) {
      setError("Source and destination accounts must be different.");
      return;
    }

    setLoading(true);
    try {
      const data = await transferFunds({
        from_account_number: form.from_account_number,
        to_account_number:   form.to_account_number,
        amount,
        description: form.description || undefined,
        idempotency_key: idempotencyKeyRef.current,
      });

      setResult(data);

      // Reset form fields (keep from_account) and generate a fresh idempotency key
      setForm((prev) => ({
        ...prev,
        to_account_number: "",
        amount: "",
        description: "",
      }));
      idempotencyKeyRef.current = crypto.randomUUID();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Transfer failed. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // ── Derived: selected account object ─────────────────────────────────────
  const selectedAccount = accounts.find(
    (a) => a.account_number === form.from_account_number
  );

  return (
    <div className="animate-fade-in max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ArrowLeftRight className="h-6 w-6 text-indigo-400" />
          Transfer Funds
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Send money from your account to any FinTrack account.
        </p>
      </div>

      {/* Success result */}
      {result && (
        <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 animate-slide-down">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <span className="font-semibold text-emerald-400">{result.message}</span>
          </div>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-slate-500">Amount</dt>
            <dd className="text-white font-medium">
              {formatCurrency(result.transaction?.amount)}
            </dd>
            <dt className="text-slate-500">Reference</dt>
            <dd className="font-mono text-xs text-slate-300 truncate">
              {result.transaction?.reference_id ?? "—"}
            </dd>
            <dt className="text-slate-500">Status</dt>
            <dd className="capitalize text-emerald-400">
              {result.transaction?.status ?? "—"}
            </dd>
          </dl>
        </div>
      )}

      <div className="glass-card p-6 space-y-5">
        {accountsLoading && <LoadingSpinner message="Loading your accounts…" />}

        {!accountsLoading && accountsError && (
          <ErrorMessage message={accountsError} />
        )}

        {!accountsLoading && accounts.length === 0 && !accountsError && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            You need at least one account to make a transfer.
          </div>
        )}

        {!accountsLoading && accounts.length > 0 && (
          <form id="transfer-form" onSubmit={handleSubmit} className="space-y-5">
            <ErrorMessage message={error} onDismiss={() => setError("")} />

            {/* From account */}
            <div>
              <label htmlFor="from-account" className="block text-sm font-medium text-slate-300 mb-1.5">
                From account
              </label>
              <select
                id="from-account"
                name="from_account_number"
                value={form.from_account_number}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500/60 transition-all"
              >
                <option value="" disabled>Select an account</option>
                {accounts
                  .filter((a) => a.status === "active")
                  .map((a) => (
                    <option key={a.id} value={a.account_number} className="bg-[#1a1d2e]">
                      {a.account_number} — {a.account_type} (
                      {formatCurrency(a.balance, a.currency)})
                    </option>
                  ))}
              </select>
              {selectedAccount && (
                <p className="mt-1 text-xs text-slate-500">
                  Balance: {formatCurrency(selectedAccount.balance, selectedAccount.currency)}
                </p>
              )}
            </div>

            {/* To account number */}
            <div>
              <label htmlFor="to-account" className="block text-sm font-medium text-slate-300 mb-1.5">
                Recipient account number
              </label>
              <input
                id="to-account"
                name="to_account_number"
                type="text"
                inputMode="numeric"
                pattern="\d{12}"
                maxLength={12}
                required
                value={form.to_account_number}
                onChange={handleChange}
                placeholder="12-digit account number"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500/60 focus:bg-white/8 transition-all font-mono tracking-wider"
              />
            </div>

            {/* Amount */}
            <div>
              <label htmlFor="transfer-amount" className="block text-sm font-medium text-slate-300 mb-1.5">
                Amount (₹)
              </label>
              <input
                id="transfer-amount"
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={form.amount}
                onChange={handleChange}
                placeholder="0.00"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500/60 focus:bg-white/8 transition-all"
              />
            </div>

            {/* Description (optional) */}
            <div>
              <label htmlFor="transfer-description" className="block text-sm font-medium text-slate-300 mb-1.5">
                Description{" "}
                <span className="text-slate-500 font-normal">(optional)</span>
              </label>
              <input
                id="transfer-description"
                name="description"
                type="text"
                maxLength={255}
                value={form.description}
                onChange={handleChange}
                placeholder="e.g. Rent payment"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500/60 focus:bg-white/8 transition-all"
              />
            </div>

            {/* Idempotency key (read-only info) */}
            <div className="rounded-xl border border-white/5 bg-white/3 px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">Idempotency key (auto-generated)</p>
              <p className="font-mono text-xs text-slate-400 break-all">
                {idempotencyKeyRef.current}
              </p>
            </div>

            {/* Submit */}
            <button
              id="transfer-submit"
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
            >
              {loading ? (
                <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <ArrowLeftRight className="h-4 w-4" />
              )}
              {loading ? "Processing transfer…" : "Transfer funds"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
