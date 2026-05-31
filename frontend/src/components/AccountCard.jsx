/**
 * components/AccountCard.jsx
 *
 * Displays a single bank account in a stylised card.
 *
 * Props:
 *   account — an account object from GET /api/accounts
 *   { id, account_number, account_type, balance, currency, status, created_at }
 *
 *   isSelected — highlights the card when it is the active account
 *   onClick    — called when the card is clicked (e.g. to switch active account)
 */

import { formatCurrency } from "../utils/formatCurrency";
import { formatDateShort } from "../utils/formatDate";
import { Wallet, CreditCard } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────
function AccountTypeBadge({ type }) {
  const styles = {
    savings: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    checking: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${
        styles[type] ?? "bg-slate-500/15 text-slate-400 border-slate-500/30"
      }`}
    >
      {type}
    </span>
  );
}

function StatusBadge({ status }) {
  const styles = {
    active: "bg-green-500/15 text-green-400",
    frozen: "bg-amber-500/15 text-amber-400",
    closed: "bg-red-500/15 text-red-400",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
        styles[status] ?? "bg-slate-500/15 text-slate-400"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === "active" ? "bg-green-400" : status === "frozen" ? "bg-amber-400" : "bg-red-400"
        }`}
      />
      {status}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function AccountCard({ account, isSelected = false, onClick }) {
  const isSavings = account.account_type === "savings";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl p-5 transition-all duration-200 border ${
        isSelected
          ? "border-indigo-500/50 bg-indigo-500/10 shadow-lg shadow-indigo-500/10"
          : "border-white/8 bg-white/4 hover:border-white/15 hover:bg-white/6"
      }`}
    >
      {/* Top row: icon + type badge + status */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className={`rounded-xl p-2 ${
              isSavings ? "bg-emerald-500/15 text-emerald-400" : "bg-sky-500/15 text-sky-400"
            }`}
          >
            {isSavings ? <Wallet className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
          </div>
          <AccountTypeBadge type={account.account_type} />
        </div>
        <StatusBadge status={account.status} />
      </div>

      {/* Account number */}
      <p className="font-mono text-sm text-slate-400 mb-1 tracking-widest">
        {account.account_number.replace(/(\d{4})(\d{4})(\d{4})/, "$1 $2 $3")}
      </p>

      {/* Balance */}
      <p className="text-2xl font-semibold text-white mt-2">
        {formatCurrency(account.balance, account.currency ?? "INR")}
      </p>

      {/* Created date */}
      <p className="text-xs text-slate-500 mt-2">
        Opened {formatDateShort(account.created_at)}
      </p>
    </button>
  );
}
