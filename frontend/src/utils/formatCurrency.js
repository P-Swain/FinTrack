/**
 * formatCurrency.js
 * Formats a number as a currency string using the browser's Intl API.
 *
 * @param {number|string} amount  - The amount to format
 * @param {string}        currency - ISO 4217 currency code (default: "INR")
 * @returns {string}  e.g. "₹1,23,456.78"
 */
export function formatCurrency(amount, currency = "INR") {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;

  if (isNaN(num)) return "—";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}
