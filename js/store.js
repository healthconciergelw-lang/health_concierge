/**
 * store.js — In-memory state + localStorage adapter
 *
 * Single source of truth for all application data. Reads come from the
 * in-memory `state` object (synchronous, fast). Writes flush to localStorage
 * within 300 ms via `persist()`. On write failure the in-memory state is kept
 * and a polite warning is announced to the ARIA live region.
 *
 * localStorage keys (hc: namespace)
 *   hc:clients           Client[]
 *   hc:goals             Goal[]
 *   hc:habitAssignments  HabitAssignment[]
 *   hc:habitCompletions  HabitCompletion[]
 *   hc:checkIns          CheckIn[]
 *   hc:followUpNotes     FollowUpNote[]
 *   hc:settings          Settings
 *   hc:initialized       "true"  (set by mockData seed on first launch)
 */

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

/** @type {Record<string, any>} */
const state = {
  clients:           [],
  goals:             [],
  habitAssignments:  [],
  habitCompletions:  [],
  checkIns:          [],
  followUpNotes:     [],
  settings:          {},
};

/**
 * Maps each state key to its localStorage key.
 * `hc:initialized` is managed by mockData.js and is not part of the
 * regular state map; it is never read back into `state`.
 */
const LS_KEYS = {
  clients:           'hc:clients',
  goals:             'hc:goals',
  habitAssignments:  'hc:habitAssignments',
  habitCompletions:  'hc:habitCompletions',
  checkIns:          'hc:checkIns',
  followUpNotes:     'hc:followUpNotes',
  settings:          'hc:settings',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const store = {
  /**
   * True when localStorage is completely unavailable (e.g. private browsing
   * on some browsers, or access denied). Set by `load()` before any module
   * renders. main.js reads this flag to show a persistent session banner.
   * @type {boolean}
   */
  storageUnavailable: false,

  /**
   * Reads all 8 `hc:*` keys from localStorage into state on startup.
   * - Detects unavailable localStorage and sets `store.storageUnavailable = true`.
   * - Missing or unparseable keys are silently initialised to their empty defaults.
   *
   * @returns {void}
   */
  load() {
    // 1. Check that localStorage is actually accessible.
    if (!_isLocalStorageAvailable()) {
      this.storageUnavailable = true;
      return; // state remains at empty defaults
    }

    // 2. Load each collection.
    for (const [stateKey, lsKey] of Object.entries(LS_KEYS)) {
      const raw = localStorage.getItem(lsKey);
      if (raw === null) continue; // key not yet written; keep default

      try {
        state[stateKey] = JSON.parse(raw);
      } catch {
        // Corrupt JSON — keep the empty default; data will be re-written on
        // the next save, effectively resetting that collection.
        console.warn(`[store] Failed to parse ${lsKey}; resetting to default.`);
      }
    }
  },

  /**
   * Returns a shallow copy of `state[key]`.
   *
   * - Arrays  → `Array.prototype.slice()` (new array, same element references)
   * - Objects → `Object.assign({}, value)`
   * - Primitives → returned as-is
   *
   * @param {string} key - One of the keys defined in `state`
   * @returns {any}
   */
  get(key) {
    const value = state[key];
    if (Array.isArray(value)) {
      return value.slice();
    }
    if (value !== null && typeof value === 'object') {
      return Object.assign({}, value);
    }
    return value;
  },

  /**
   * Sets `state[key]` to `value` and schedules a localStorage flush within
   * 300 ms. If the write fails, in-memory state is kept and a polite storage
   * warning is announced to the ARIA live region.
   *
   * @param {string} key   - One of the keys defined in `state`
   * @param {any}    value - The new value to store
   * @returns {void}
   */
  set(key, value) {
    state[key] = value;
    _schedulePersist(key, value);
  },
};

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

/** @type {Record<string, ReturnType<typeof setTimeout>>} */
const _pendingFlush = {};

/**
 * Debounces a localStorage write so that rapid successive `set()` calls for
 * the same key are collapsed into a single write, which occurs within 300 ms.
 *
 * @param {string} key
 * @param {any}    value
 */
function _schedulePersist(key, value) {
  if (_pendingFlush[key] !== undefined) {
    clearTimeout(_pendingFlush[key]);
  }
  _pendingFlush[key] = setTimeout(() => {
    delete _pendingFlush[key];
    _persist(key, value);
  }, 300);
}

/**
 * Writes a single collection to localStorage.
 * On failure: keeps in-memory state (already set by `store.set()`) and
 * announces a polite warning to the `role="status"` ARIA live region.
 *
 * @param {string} key   - state key (e.g. "clients")
 * @param {any}    value - the value to serialise
 */
function _persist(key, value) {
  const lsKey = LS_KEYS[key];
  if (!lsKey) return; // unknown key — no-op

  try {
    localStorage.setItem(lsKey, JSON.stringify(value));
  } catch (err) {
    // Quota exceeded, access denied, or storage unavailable.
    // In-memory state is already correct — only the persistence failed.
    console.warn(`[store] localStorage write failed for ${lsKey}:`, err);
    _announceStorageWarning();
  }
}

/**
 * Announces a polite storage warning to the `role="status"` aria-live region
 * so screen readers and the UI can surface the message without interrupting
 * the user's current interaction.
 *
 * The element with `role="status"` is defined in index.html. If it has not
 * yet been added to the DOM (e.g. during unit tests), the call is a no-op.
 */
function _announceStorageWarning() {
  const region = document.querySelector('[role="status"]');
  if (region) {
    region.textContent =
      'Change saved in memory only. Data will be lost on reload.';
  }
}

// ---------------------------------------------------------------------------
// localStorage availability detection
// ---------------------------------------------------------------------------

/**
 * Probes whether localStorage is accessible in the current browser context.
 * Some browsers disable it entirely in private/incognito mode, and some
 * extensions or iframe sandboxes deny access, causing `getItem` / `setItem`
 * to throw a `SecurityError`.
 *
 * @returns {boolean}
 */
function _isLocalStorageAvailable() {
  const probe = '__hc_probe__';
  try {
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}
