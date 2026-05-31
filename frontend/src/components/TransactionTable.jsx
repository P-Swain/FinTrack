/**
 * components/TransactionTable.jsx
 *
 * Renders a list of transactions in a responsive table.
 *
 * Props:
 *   transactions — array of transaction objects from GET /api/transactions
 *   Each object: {
 *     id, transaction_type, amount, currency, status, description,
 *     reference_id, created_at, from_account_number, to_account_number, direction
 *   }
 *   direction: "debit" | "credit"
 *
 *   compact — boolean (default false): hides description column for tighter layouts
 */

import { formatCurrency } from "../utils/formatCurrency";
import { formatDate } from "../utils/formatDate";
import { ArrowUpRight, ArrowDownLeft, ArrowLeftRight } from "lucide-react";

// ── Helper sub-components ─────────────────────────────────────────────────────
function TypeIcon({ type, direction }) {
  if (type === "transfer") {
    return <ArrowLeftRight className="h-4 w-4 text-violet-400" />;
  }
  if (direction === "credit" || type === "deposit") {
    return <ArrowDownLeft className="h-4 w-4 text-emerald-400" />;
  }
  return <ArrowUpRight className="h-4 w-4 text-red-400" />;
}

function AmountCell({ amount, currency, direction, type }) {
  const isPositive = direction === "credit" || type === "deposit";
  return (
    <span
      className={`font-semibold ${
        isPositive ? "text-emerald-400" : "text-red-400"
      }`}
    >
      {isPositive ? "+" : "-"}
      {formatCurrency(Math.abs(amount), currency ?? "INR")}
    </span>
  );
}

function StatusBadge({ status }) {
  const styles = {
    completed: "bg-green-500/15 text-green-400",
    pending:   "bg-amber-500/15 text-amber-400",
    failed:    "bg-red-500/15 text-red-400",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
        styles[status] ?? "bg-slate-500/15 text-slate-400"
      }`}
    >
      {status}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function TransactionTable({ transactions = [], compact = false }) {
  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-500">
        <ArrowLeftRight className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">No transactions found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/8 text-left text-xs text-slate-500 uppercase tracking-wide">
            <th className="pb-3 pr-4">Type</th>
            <th className="pb-3 pr-4">From</th>
            <th className="pb-3 pr-4">To</th>
            {!compact && <th className="pb-3 pr-4">Description</th>}
            <th className="pb-3 pr-4">Amount</th>
            <th className="pb-3 pr-4">Status</th>
            <th className="pb-3">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {transactions.map((tx) => (
            <tr
              key={tx.id}
              className="group transition-colors hover:bg-white/3"
            >
              {/* Type + direction icon */}
              <td className="py-3 pr-4">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-white/5 p-1.5">
                    <TypeIcon type={tx.transaction_type} direction={tx.direction} />
                  </div>
                  <span className="capitalize text-slate-300">{tx.transaction_type}</span>
                </div>
              </td>

              {/* From account number */}
              <td className="py-3 pr-4 font-mono text-xs text-slate-400">
                {tx.from_account_number ?? "—"}
              </td>

              {/* To account number */}
              <td className="py-3 pr-4 font-mono text-xs text-slate-400">
                {tx.to_account_number ?? "—"}
              </td>

              {/* Description (hidden in compact mode) */}
              {!compact && (
                <td className="py-3 pr-4 text-slate-400 max-w-[180px] truncate">
                  {tx.description ?? "—"}
                </td>
              )}

              {/* Amount */}
              <td className="py-3 pr-4">
                <AmountCell
                  amount={tx.amount}
                  currency={tx.currency}
                  direction={tx.direction}
                  type={tx.transaction_type}
                />
              </td>

              {/* Status */}
              <td className="py-3 pr-4">
                <StatusBadge status={tx.status} />
              </td>

              {/* Date */}
              <td className="py-3 text-xs text-slate-500 whitespace-nowrap">
                {formatDate(tx.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
