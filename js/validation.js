/**
 * validation.js — Shared field validators for Health Concierge Tracker
 *
 * Each validator either:
 *  - returns `true` if the value passes validation, or
 *  - returns a non-empty string error message if the value fails.
 *
 * Higher-order validators (e.g. maxLength, range) return a validator function
 * when called with configuration arguments.
 *
 * Usage with FormValidator:
 *   formValidator.register('fullName', [validators.required, validators.maxLength(100)]);
 */

import * as utils from './utils.js';

export const validators = {
  /**
   * Fails when the value is null, undefined, or trims to an empty string.
   * @param {*} v
   * @returns {true|string}
   */
  required: (v) =>
    (v !== null && v !== undefined && String(v).trim() !== '') ||
    'This field is required.',

  /**
   * Fails when the string length exceeds n characters.
   * @param {number} n  Maximum allowed character count
   * @returns {(v: *) => true|string}
   */
  maxLength: (n) => (v) =>
    String(v).length <= n || `Must be ${n} characters or fewer.`,

  /**
   * Fails when the trimmed string length is less than n characters.
   * @param {number} n  Minimum required character count (after trimming)
   * @returns {(v: *) => true|string}
   */
  minLength: (n) => (v) =>
    String(v).trim().length >= n || `Must be at least ${n} character(s).`,

  /**
   * Fails when the value cannot be parsed as a finite number.
   * @param {*} v
   * @returns {true|string}
   */
  numeric: (v) =>
    (!isNaN(parseFloat(v)) && isFinite(v)) || 'Must be a number.',

  /**
   * Fails when the numeric value is outside [min, max] (inclusive).
   * Requires the value to already be numeric; combine with `numeric` if needed.
   * @param {number} min
   * @param {number} max
   * @returns {(v: *) => true|string}
   */
  range: (min, max) => (v) => {
    const n = parseFloat(v);
    return (n >= min && n <= max) || `Must be between ${min} and ${max}.`;
  },

  /**
   * Fails when the value is not a whole number or is outside [min, max] (inclusive).
   * Intended for integer fields such as Mood Score and Energy Score (1–10).
   * @param {number} min
   * @param {number} max
   * @returns {(v: *) => true|string}
   */
  integerRange: (min, max) => (v) => {
    const n = Number(v);
    return (
      (Number.isInteger(n) && n >= min && n <= max) ||
      `Must be a whole number between ${min} and ${max}.`
    );
  },

  /**
   * Fails when the value does not match the Client ID pattern:
   * 1–50 characters, containing only letters (A-Z, a-z), digits (0-9), or hyphens.
   * @param {*} v
   * @returns {true|string}
   */
  clientIdFormat: (v) =>
    /^[A-Za-z0-9-]{1,50}$/.test(v) ||
    'Only letters, numbers, and hyphens allowed (max 50 chars).',

  /**
   * Returns a validator that fails when the entered Client ID already belongs to a
   * *different* client (i.e. it exists in existingIds but is not the currentId).
   *
   * Pass `currentId` as null / undefined when creating a new client (no ID to exempt).
   *
   * @param {string[]} existingIds  All Client IDs currently in the data store
   * @param {string|null} currentId The Client ID of the record being edited (exempt from uniqueness check)
   * @returns {(v: *) => true|string}
   */
  uniqueClientId: (existingIds, currentId) => (v) =>
    v === currentId ||
    !existingIds.includes(v) ||
    'A client with this ID already exists.',

  /**
   * Fails when the value is a non-empty string that represents a date in the past
   * (i.e. earlier than today's ISO date).  Empty / falsy values pass (field is optional).
   *
   * Relies on `utils.today()` so that "today" is always computed at call time.
   * @param {*} v  ISO date string "YYYY-MM-DD" or empty / falsy
   * @returns {true|string}
   */
  notPastDate: (v) =>
    !v || v >= utils.today() || 'Date must be today or a future date.',

  /**
   * Fails when the value, after trimming, has a length of zero.
   * Prevents saving records that contain only spaces, tabs, or newlines.
   * @param {*} v
   * @returns {true|string}
   */
  notWhitespaceOnly: (v) =>
    String(v).trim().length > 0 ||
    'Must contain at least one non-whitespace character.',
};
