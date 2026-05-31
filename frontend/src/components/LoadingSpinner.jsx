/**
 * components/LoadingSpinner.jsx
 *
 * A simple centered animated spinner.
 * Pass size="sm" | "md" (default) | "lg" to control dimensions.
 */

export default function LoadingSpinner({ size = "md", message = "" }) {
  const sizes = {
    sm: "h-5 w-5 border-2",
    md: "h-10 w-10 border-4",
    lg: "h-16 w-16 border-4",
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <div
        className={`${sizes[size]} rounded-full border-indigo-500 border-t-transparent animate-spin`}
        style={{ animation: "spin 0.8s linear infinite" }}
        role="status"
        aria-label="Loading"
      />
      {message && (
        <p className="text-sm text-slate-400">{message}</p>
      )}
    </div>
  );
}
