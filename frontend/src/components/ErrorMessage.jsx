/**
 * components/ErrorMessage.jsx
 *
 * Displays an API or validation error in a styled alert box.
 * onDismiss is optional — if not provided, the × button is hidden.
 */

import { X, AlertCircle } from "lucide-react";

export default function ErrorMessage({ message, onDismiss }) {
  if (!message) return null;

  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 animate-slide-down"
      role="alert"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-red-400 hover:text-red-300 transition-colors"
          aria-label="Dismiss error"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
