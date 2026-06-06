/**
 * exportImport.js — JSON serialisation / deserialisation + round-trip logic
 *
 * Export: serialises all 7 store collections to a JSON blob and triggers a
 *         browser download.
 *
 * Import: reads a File object, validates the JSON structure, and atomically
 *         replaces all 7 store collections.
 *
 * Both operations leave store state unchanged on failure.
 */

import { today } from './utils.js';
import { Toast } from './components.js';

// ---------------------------------------------------------------------------
// ImportError
// ---------------------------------------------------------------------------

/**
 * Structured error thrown during import validation.
 *
 * @property {'malformed-json'|'missing-fields'} code  - Machine-readable error code
 * @property {string} message                           - Human-readable description
 */
export class ImportError extends Error {
  /**
   * @param {'malformed-json'|'missing-fields'} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = 'ImportError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// The 7 data collections that make up a full export / import payload
// ---------------------------------------------------------------------------

const COLLECTION_KEYS = [
  'clients',
  'goals',
  'habitAssignments',
  'habitCompletions',
  'checkIns',
  'followUpNotes',
  'settings',
];

/** Keys that must be Arrays in raw.data */
const ARRAY_KEYS = [
  'clients',
  'goals',
  'habitAssignments',
  'habitCompletions',
  'checkIns',
  'followUpNotes',
];

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * Serialises all 7 store collections to a JSON file and triggers a browser
 * download. Calls `Toast.show` on success or failure.
 *
 * Empty datasets are exported as valid JSON (empty arrays / empty object).
 *
 * @param {import('./store.js').store} store - The application store instance
 * @returns {void}
 */
export function exportData(store) {
  try {
    const payload = {
      version: '1',
      exportedAt: new Date().toISOString(),
      data: {
        clients:          store.get('clients'),
        goals:            store.get('goals'),
        habitAssignments: store.get('habitAssignments'),
        habitCompletions: store.get('habitCompletions'),
        checkIns:         store.get('checkIns'),
        followUpNotes:    store.get('followUpNotes'),
        settings:         store.get('settings'),
      },
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = `health-concierge-export-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    Toast.show('Data exported successfully.', 'success');
  } catch (err) {
    console.error('[exportImport] Export failed:', err);
    Toast.show('Export failed. Please try again.', 'error');
  }
}

// ---------------------------------------------------------------------------
// Import — schema validation
// ---------------------------------------------------------------------------

/**
 * Validates the top-level shape of a parsed import payload.
 *
 * Checks:
 *  1. `raw.version` field is present
 *  2. `raw.data` is a non-null, non-array object
 *  3. All 7 required keys exist inside `raw.data`
 *  4. The 6 array keys (`clients`, `goals`, `habitAssignments`,
 *     `habitCompletions`, `checkIns`, `followUpNotes`) are actual Arrays
 *  5. `settings` is a plain object (not an Array, not null)
 *
 * All errors are accumulated; if any exist, a single `ImportError` with code
 * `'missing-fields'` is thrown whose message is all errors joined by `'; '`.
 *
 * @param {unknown} raw - The result of `JSON.parse(fileText)`
 * @throws {ImportError} When any validation rule fails
 */
export function validateImportSchema(raw) {
  const errors = [];

  // 1. version
  if (raw === null || typeof raw !== 'object' || !('version' in raw) || raw.version == null) {
    errors.push('Missing required field: version');
  }

  // 2. data object
  if (
    raw === null ||
    typeof raw !== 'object' ||
    !('data' in raw) ||
    raw.data === null ||
    typeof raw.data !== 'object' ||
    Array.isArray(raw.data)
  ) {
    errors.push('Missing or invalid field: data (must be an object)');
    // Without a valid data object, subsequent checks are meaningless
    if (errors.length > 0) {
      throw new ImportError('missing-fields', errors.join('; '));
    }
  }

  const data = raw.data;

  // 3. All 7 keys must exist in data
  for (const key of COLLECTION_KEYS) {
    if (!(key in data)) {
      errors.push(`Missing required field: data.${key}`);
    }
  }

  // 4. Array keys must be actual Arrays (only check if key exists)
  for (const key of ARRAY_KEYS) {
    if (key in data && !Array.isArray(data[key])) {
      errors.push(`data.${key} must be an array`);
    }
  }

  // 5. settings must be a plain object (not an Array, not null, not primitive)
  if ('settings' in data) {
    if (
      data.settings === null ||
      typeof data.settings !== 'object' ||
      Array.isArray(data.settings)
    ) {
      errors.push('data.settings must be an object (not an array)');
    }
  }

  if (errors.length > 0) {
    throw new ImportError('missing-fields', errors.join('; '));
  }
}

// ---------------------------------------------------------------------------
// Import — main entry point
// ---------------------------------------------------------------------------

/**
 * Reads a JSON `File`, validates its schema, and atomically replaces all 7
 * store collections with the imported data.
 *
 * - On JSON parse failure: throws `ImportError('malformed-json', …)`
 * - On schema validation failure: throws `ImportError('missing-fields', …)`
 * - On any error: store collections are left completely unchanged
 * - On success: all 7 collections are replaced and in-memory state is refreshed
 *   via `store.set()` (which also schedules localStorage persistence)
 *
 * @param {File}                      file  - The file selected by the user
 * @param {import('./store.js').store} store - The application store instance
 * @returns {Promise<object>}               - Resolves with the imported data object
 * @throws {ImportError}                    - On parse or validation failure
 */
export async function importData(file, store) {
  // Step 1: read raw text
  const text = await file.text();

  // Step 2: parse JSON — throw ImportError on failure (leaves store untouched)
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ImportError('malformed-json', 'The file contains invalid JSON syntax.');
  }

  // Step 3: validate schema — throws ImportError on failure (leaves store untouched)
  // No try/catch here; caller is responsible for handling the error.
  validateImportSchema(raw);

  // Step 4: atomically replace all 7 collections
  // All reads above succeeded, so we now commit. store.set() updates both
  // in-memory state and schedules a localStorage flush within 300 ms.
  COLLECTION_KEYS.forEach(key => store.set(key, raw.data[key]));

  // Step 5: return the imported data object for callers that need it
  return raw.data;
}
