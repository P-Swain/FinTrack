/**
 * formatDate.js
 * Formats an ISO date string into a human-readable form.
 *
 * @param {string|Date} dateString - ISO 8601 date string or Date object
 * @param {object}      options    - Optional Intl.DateTimeFormat options override
 * @returns {string}  e.g. "12 May 2026, 10:30 AM"
 */
export function formatDate(dateString, options = {}) {
  if (!dateString) return "—";

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "—";

  const defaultOptions = {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  };

  return new Intl.DateTimeFormat("en-IN", { ...defaultOptions, ...options }).format(date);
}

/**
 * formatDateShort
 * Returns just the date portion: "12 May 2026"
 */
export function formatDateShort(dateString) {
  return formatDate(dateString, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: undefined,
    minute: undefined,
    hour12: undefined,
  });
}

/**
 * formatMonthYear
 * Returns "May 2026" — used by the analytics chart.
 */
export function formatMonthYear(dateString) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(date);
}
