/**
 * utils.js — Date helpers, ID generators, and format utilities
 *
 * All date operations are based on the local (coach's) time zone.
 * ISO week boundaries: Monday 00:00:00 through Sunday 23:59:59.
 */

/**
 * Returns today's date as an ISO date string (YYYY-MM-DD) in local time.
 * @returns {string}
 */
export function today() {
  const d = new Date();
  return _toISODate(d);
}

/**
 * Returns an ISO date string (YYYY-MM-DD) for the date that is `n` calendar
 * days before today (local time). `daysAgo(0)` returns today.
 * @param {number} n - Number of days to go back (non-negative integer)
 * @returns {string}
 */
export function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return _toISODate(d);
}

/**
 * Given a Date object (or an ISO date string), returns the ISO date strings
 * for Monday and Sunday of the ISO week containing that date.
 *
 * ISO week: Monday = day 1, Sunday = day 7.
 *
 * @param {Date|string} date - A Date instance or "YYYY-MM-DD" string
 * @returns {{ monday: string, sunday: string }}
 */
export function getISOWeekRange(date) {
  const d = _toDate(date);

  // getDay(): 0 = Sunday, 1 = Monday, …, 6 = Saturday
  // Convert to ISO weekday: Monday = 1, …, Sunday = 7
  const dow = d.getDay(); // 0–6
  const isoDay = dow === 0 ? 7 : dow; // 1–7

  const monday = new Date(d);
  monday.setDate(d.getDate() - (isoDay - 1));

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    monday: _toISODate(monday),
    sunday: _toISODate(sunday),
  };
}

/**
 * Returns true if `dateStr` (YYYY-MM-DD) falls in the inclusive range
 * [todayStr, todayStr + 6 days], i.e. today through today + 6 days.
 *
 * @param {string} dateStr  - The date to test (YYYY-MM-DD)
 * @param {string} todayStr - The reference "today" date (YYYY-MM-DD)
 * @returns {boolean}
 */
export function isWithinNext7Days(dateStr, todayStr) {
  if (!dateStr || !todayStr) return false;

  // Compare as strings — ISO date strings sort lexicographically,
  // which is equivalent to chronological order.
  const todayPlus6 = _addDays(todayStr, 6);
  return dateStr >= todayStr && dateStr <= todayPlus6;
}

/**
 * Generates a UUID v4 string.
 *
 * Uses `crypto.randomUUID()` when available (all modern browsers and
 * Node 14.17+), falling back to a manual Math.random implementation for
 * environments that lack the Web Crypto API.
 *
 * @returns {string} UUID v4, e.g. "550e8400-e29b-41d4-a716-446655440000"
 */
export function generateId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  // Fallback: RFC 4122 section 4.4 manual implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Formats an ISO date string (YYYY-MM-DD) into a locale-friendly display
 * string for the coach's local time zone.
 *
 * Example output (en-US): "Jan 15, 2025"
 *
 * @param {string} isoStr - ISO date string "YYYY-MM-DD"
 * @returns {string} Locale-formatted date string, or "" if input is falsy
 */
export function formatDate(isoStr) {
  if (!isoStr) return '';

  // Parse YYYY-MM-DD as a local date (midnight local time) to avoid
  // off-by-one day errors caused by UTC vs. local timezone offset.
  const [year, month, day] = isoStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);

  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Converts a Date to a local-time ISO date string "YYYY-MM-DD".
 * @param {Date} d
 * @returns {string}
 */
function _toISODate(d) {
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day   = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Accepts a Date object or a "YYYY-MM-DD" string and returns a Date at
 * local midnight for that calendar day. A Date instance is returned as-is
 * (no copy) so that callers can mutate without affecting the original.
 * @param {Date|string} value
 * @returns {Date}
 */
function _toDate(value) {
  if (value instanceof Date) return value;
  const [year, month, day] = String(value).split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Adds `n` days to an ISO date string and returns the resulting ISO date string.
 * @param {string} isoStr - "YYYY-MM-DD"
 * @param {number} n
 * @returns {string}
 */
function _addDays(isoStr, n) {
  const d = _toDate(isoStr);
  d.setDate(d.getDate() + n);
  return _toISODate(d);
}
