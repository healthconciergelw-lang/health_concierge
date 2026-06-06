/**
 * components.js — Shared UI Components
 *
 * Exports: Modal, ConfirmDialog, Toast, LoadingIndicator, StatusBadge,
 *          SortableTable, FormValidator
 *
 * Requirements: 2.4, 3.4, 18.1–18.6, 19.2, 20.2, 20.3, 20.4
 */

// ─── Modal ────────────────────────────────────────────────────────────────────
/**
 * Modal — accessible dialog with focus trap, ESC close, and CSS transition.
 *
 * DOM prerequisites (index.html):
 *   <div id="modal-root" aria-hidden="true"></div>
 *
 * Requirements: 7.5, 14.6, 18.5, 20.3
 *
 * Usage:
 *   Modal.open('Title', '<p>Body HTML</p>', {
 *     onConfirm: () => {},
 *     onCancel:  () => {},
 *     confirmText: 'Save',   // default: 'Confirm'
 *     cancelText:  'Cancel', // default: 'Cancel'
 *     showFooter:  true,     // default: true
 *   });
 *   Modal.close();
 */

/** Monotonically-increasing uid for unique aria-labelledby IDs */
let _modalUid = 0;

/** Reference to the currently-open overlay element (or null) */
let _currentOverlay = null;

/** Element that was focused before the modal opened — restored on close */
let _previouslyFocused = null;

/** Bound keydown handler so it can be removed on close */
let _keydownHandler = null;

/**
 * Return all focusable elements within a container that are not disabled.
 * @param {Element} container
 * @returns {Element[]}
 */
function _getFocusable(container) {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');
  return Array.from(container.querySelectorAll(selector)).filter(
    (el) => !el.closest('[disabled]') && el.offsetParent !== null
  );
}

export const Modal = {
  /**
   * Open a modal dialog.
   *
   * @param {string} title       - Text shown in the modal header.
   * @param {string} bodyHTML    - Arbitrary HTML injected into .modal-body.
   * @param {object} [options]
   * @param {Function} [options.onConfirm]         - Called when the confirm button is clicked.
   * @param {Function} [options.onCancel]          - Called when the dialog is cancelled (close btn / ESC).
   * @param {string}   [options.confirmText='Confirm']
   * @param {string}   [options.cancelText='Cancel']
   * @param {boolean}  [options.showFooter=true]   - Whether to render the footer with action buttons.
   */
  open(title, bodyHTML, options = {}) {
    const {
      onConfirm,
      onCancel,
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      showFooter = true,
    } = options;

    const root = document.getElementById('modal-root');
    if (!root) return;

    // Close any currently-open modal first
    if (_currentOverlay) {
      this.close();
    }

    // Save focus so we can restore it after close
    _previouslyFocused = document.activeElement;

    const uid = ++_modalUid;
    const titleId = `modal-title-${uid}`;

    // Build footer HTML
    const footerHTML = showFooter
      ? `<div class="modal-footer">
           <button type="button" class="btn btn-secondary modal-cancel-btn">${_escapeHtml(cancelText)}</button>
           <button type="button" class="btn btn-danger modal-confirm-btn">${_escapeHtml(confirmText)}</button>
         </div>`
      : '';

    // Build the full overlay → dialog structure
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="${titleId}"
      >
        <div class="modal-header">
          <span class="modal-title" id="${titleId}">${_escapeHtml(title)}</span>
          <button type="button" class="modal-close" aria-label="Close dialog">
            <svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 20 20" fill="none"
                 xmlns="http://www.w3.org/2000/svg">
              <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" stroke-width="1.5"
                    stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">${bodyHTML}</div>
        ${footerHTML}
      </div>
    `;

    root.appendChild(overlay);
    root.setAttribute('aria-hidden', 'false');
    _currentOverlay = overlay;

    // ── Wire up close/confirm buttons ────────────────────────────────────────
    const closeBtn = overlay.querySelector('.modal-close');
    closeBtn.addEventListener('click', () => {
      this.close();
      onCancel?.();
    });

    if (showFooter) {
      const cancelBtn = overlay.querySelector('.modal-cancel-btn');
      const confirmBtn = overlay.querySelector('.modal-confirm-btn');

      cancelBtn.addEventListener('click', () => {
        this.close();
        onCancel?.();
      });

      confirmBtn.addEventListener('click', () => {
        this.close();
        onConfirm?.();
      });
    }

    // ── Keyboard handler: ESC closes; Tab traps focus ─────────────────────────
    const dialog = overlay.querySelector('.modal');

    _keydownHandler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
        onCancel?.();
        return;
      }

      if (e.key === 'Tab') {
        const focusable = _getFocusable(dialog);
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          // Shift+Tab: if focus is on first element, wrap to last
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          // Tab: if focus is on last element, wrap to first
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', _keydownHandler);

    // ── Trigger open transition on next animation frame ───────────────────────
    requestAnimationFrame(() => {
      overlay.classList.add('is-open');
      // Move focus to the first focusable element inside the dialog
      const focusable = _getFocusable(dialog);
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        dialog.setAttribute('tabindex', '-1');
        dialog.focus();
      }
    });
  },

  /**
   * Close the currently-open modal.
   * Removes .is-open, waits 200 ms for the CSS transition, then removes from DOM.
   */
  close() {
    if (!_currentOverlay) return;

    const overlay = _currentOverlay;
    _currentOverlay = null;

    // Remove keyboard handler
    if (_keydownHandler) {
      document.removeEventListener('keydown', _keydownHandler);
      _keydownHandler = null;
    }

    // Start close transition
    overlay.classList.remove('is-open');

    // After transition completes, remove from DOM and restore focus
    setTimeout(() => {
      const root = document.getElementById('modal-root');
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      if (root) {
        root.setAttribute('aria-hidden', 'true');
      }
      // Restore focus to the element that was focused before the modal opened
      if (_previouslyFocused && typeof _previouslyFocused.focus === 'function') {
        _previouslyFocused.focus();
      }
      _previouslyFocused = null;
    }, 200);
  },
};

// ─── ConfirmDialog ────────────────────────────────────────────────────────────
/**
 * ConfirmDialog — a specialised modal that returns a Promise<boolean>.
 *
 * Requirements: 7.5, 14.6
 *
 * Usage:
 *   const confirmed = await ConfirmDialog.open('Delete this record?');
 *   if (confirmed) { ... }
 */
export const ConfirmDialog = {
  /**
   * Show a confirmation dialog with Confirm and Cancel buttons.
   *
   * @param {string} message - The question or warning to display (HTML-escaped automatically).
   * @returns {Promise<boolean>} Resolves to true if confirmed, false if cancelled.
   */
  open(message) {
    return new Promise((resolve) => {
      const bodyHTML = `<p class="confirm-message">${_escapeHtml(message)}</p>`;

      Modal.open('Confirm Action', bodyHTML, {
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        showFooter: true,
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
  },
};

// ─── Toast ────────────────────────────────────────────────────────────────────
/**
 * Toast — non-blocking notification that auto-dismisses after 4 seconds.
 *
 * DOM prerequisites (index.html):
 *   <div id="toast-container"></div>
 *   <div id="live-polite" role="status" aria-live="polite" aria-atomic="true"
 *        class="sr-only"></div>
 *
 * Requirements: 18.4, 18.6
 */
export const Toast = {
  /**
   * Show a toast notification.
   *
   * @param {string} message - The text to display.
   * @param {'success'|'warning'|'error'|'info'} [type='info'] - Visual variant.
   */
  show(message, type = 'info') {
    // Validate type; fall back to info for unknown values
    const validTypes = ['success', 'warning', 'error', 'info'];
    const safeType = validTypes.includes(type) ? type : 'info';

    // Announce to screen readers via the polite live region
    const liveRegion = document.getElementById('live-polite');
    if (liveRegion) {
      // Briefly clear then set so repeated messages are re-announced
      liveRegion.textContent = '';
      // Use setTimeout(0) to ensure the DOM mutation is observed by AT
      setTimeout(() => {
        liveRegion.textContent = message;
        // Clear after 100ms — announcement has been made; live region resets
        setTimeout(() => {
          liveRegion.textContent = '';
        }, 100);
      }, 0);
    }

    // Ensure the toast container exists
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    // Build the toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${safeType}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');

    toast.innerHTML = `
      <span class="toast-message">${_escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    // Trigger enter animation on the next frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toast.classList.add('is-visible');
      });
    });

    // Auto-dismiss after 4 000 ms
    setTimeout(() => {
      toast.classList.remove('is-visible');
      toast.classList.add('is-dismissing');

      // Remove from DOM after the CSS transition completes (~200 ms)
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 200);
    }, 4000);
  },
};

// ─── LoadingIndicator ─────────────────────────────────────────────────────────
/**
 * LoadingIndicator — controls the #loading-indicator element.
 *
 * DOM prerequisites (index.html):
 *   <div id="loading-indicator" aria-hidden="true">
 *     <div class="loading-spinner"></div>
 *     <span class="loading-text">Loading…</span>
 *   </div>
 *
 * Requirements: 2.4
 */
export const LoadingIndicator = {
  /** @type {number|null} Pending showAfter timer id */
  _timerId: null,

  /**
   * Show the loading indicator immediately.
   */
  show() {
    const el = document.getElementById('loading-indicator');
    if (!el) return;
    el.classList.add('is-visible');
    el.setAttribute('aria-hidden', 'false');
  },

  /**
   * Hide the loading indicator and cancel any pending showAfter timer.
   */
  hide() {
    // Cancel a pending delayed show
    if (this._timerId !== null) {
      clearTimeout(this._timerId);
      this._timerId = null;
    }

    const el = document.getElementById('loading-indicator');
    if (!el) return;
    el.classList.remove('is-visible');
    el.setAttribute('aria-hidden', 'true');
  },

  /**
   * Show the loading indicator only if the operation is still pending after
   * the specified delay. Allows fast loads to complete without a flash.
   *
   * @param {number} ms - Milliseconds to wait before showing.
   */
  showAfter(ms) {
    // Cancel any previously scheduled show
    if (this._timerId !== null) {
      clearTimeout(this._timerId);
    }
    this._timerId = setTimeout(() => {
      this._timerId = null;
      this.show();
    }, ms);
  },
};

// ─── StatusBadge ──────────────────────────────────────────────────────────────
/**
 * StatusBadge — renders an HTML string for a pill badge using design token
 * colour classes.
 *
 * Requirements: 3.4, 20.2
 *
 * Category values and their CSS modifier classes:
 *
 *   Client Status  → Active: badge-active | Inactive: badge-inactive
 *                    | Graduated: badge-graduated
 *   Goal Status    → Not Started: badge-not-started | In Progress: badge-in-progress
 *                    | Complete: badge-complete
 *   Priority       → High: badge-high | Medium: badge-medium | Low: badge-low
 */

/** @type {Record<string, string>} Map of status text → CSS modifier class */
const STATUS_CLASS_MAP = {
  // Client Status
  'Active':      'badge-active',
  'Inactive':    'badge-inactive',
  'Graduated':   'badge-graduated',

  // Goal Status
  'Not Started': 'badge-not-started',
  'In Progress': 'badge-in-progress',
  'Complete':    'badge-complete',

  // Priority Level
  'High':   'badge-high',
  'Medium': 'badge-medium',
  'Low':    'badge-low',
};

export const StatusBadge = {
  /**
   * Return an HTML string for a pill badge.
   *
   * @param {string} text     - The label text to display inside the badge.
   * @param {string} category - One of: 'Client Status', 'Goal Status', 'Priority'
   *                            (used only for documentation; the class is derived
   *                            from `text` via STATUS_CLASS_MAP).
   * @returns {string} An HTML string like `<span class="badge badge-active">Active</span>`
   */
  render(text, category) {
    // Look up the pre-defined class; fall back to a derived slug
    const modifierClass = STATUS_CLASS_MAP[text] ?? _textToSlug(text, 'badge');
    return `<span class="badge ${modifierClass}">${_escapeHtml(text)}</span>`;
  },
};

// ─── Private helpers ──────────────────────────────────────────────────────────

/**
 * Escape HTML special characters to prevent XSS when injecting user text.
 *
 * @param {string} str
 * @returns {string}
 */
function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Convert arbitrary text to a CSS slug prefixed with a given prefix.
 * Lowercases, trims, replaces spaces with hyphens, strips non-alphanumeric chars.
 *
 * @param {string} text
 * @param {string} prefix - e.g. 'badge' produces 'badge-my-label'
 * @returns {string}
 */
function _textToSlug(text, prefix) {
  const slug = String(text)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  return `${prefix}-${slug}`;
}

// ─── SortableTable ────────────────────────────────────────────────────────────
/**
 * SortableTable — renders an accessible, sortable HTML table into a container.
 *
 * @example
 *   const columns = [
 *     { key: 'name',   label: 'Name' },
 *     { key: 'status', label: 'Status', render: (v) => StatusBadge.render(v) },
 *   ];
 *   const table = new SortableTable(containerEl, columns, rows, {
 *     onRowClick: (record) => router.navigate(`/client/${record.id}`),
 *     emptyMessage: 'No clients found.',
 *   });
 *
 * Requirements: 5.3, 7.1, 19.2, 19.4
 */
export class SortableTable {
  /**
   * @param {HTMLElement} container - The DOM element to render into.
   * @param {Array<{
   *   key: string,
   *   label: string,
   *   render?: (value: any, record: object) => string,
   *   sortable?: boolean
   * }>} columns - Column definitions.
   * @param {object[]} data - The data rows to display.
   * @param {{
   *   onRowClick?: (record: object) => void,
   *   emptyMessage?: string,
   *   defaultSort?: { key: string, direction: 'asc' | 'desc' }
   * }} [options]
   */
  constructor(container, columns, data, options = {}) {
    this._container = container;
    this._columns = columns;
    this._data = Array.isArray(data) ? data : [];
    this._onRowClick = options.onRowClick ?? null;
    this._emptyMessage = options.emptyMessage ?? 'No records found.';

    // Sort state
    this._sortKey = options.defaultSort?.key ?? null;
    this._sortDirection = options.defaultSort?.direction ?? 'asc';

    this.render();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Re-render the table from scratch into the container.
   */
  render() {
    this._container.innerHTML = '';

    if (this._data.length === 0) {
      this._renderEmpty();
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';

    const table = document.createElement('table');
    table.className = 'table table-sortable';

    table.appendChild(this._buildHead());
    table.appendChild(this._buildBody());

    wrapper.appendChild(table);
    this._container.appendChild(wrapper);
  }

  /**
   * Replace the current data set and re-render.
   *
   * @param {object[]} newData
   */
  update(newData) {
    this._data = Array.isArray(newData) ? newData : [];
    this.render();
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Toggle sort direction when the same column is clicked again;
   * reset to ascending when a new column is selected. Then re-render.
   *
   * @param {string} key
   */
  _sortBy(key) {
    if (this._sortKey === key) {
      this._sortDirection = this._sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this._sortKey = key;
      this._sortDirection = 'asc';
    }
    this.render();
  }

  /**
   * Render the empty-state message into the container.
   */
  _renderEmpty() {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    const p = document.createElement('p');
    p.textContent = this._emptyMessage;
    empty.appendChild(p);
    this._container.appendChild(empty);
  }

  /**
   * Build the sorted copy of data (does not mutate `this._data`).
   *
   * @returns {object[]}
   */
  _getSortedData() {
    if (!this._sortKey) return [...this._data];

    const key = this._sortKey;
    const dir = this._sortDirection === 'asc' ? 1 : -1;

    return [...this._data].sort((a, b) => {
      const av = a[key] ?? '';
      const bv = b[key] ?? '';

      // Numeric comparison when both values are numbers
      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * dir;
      }

      // String comparison (case-insensitive)
      return String(av).toLowerCase().localeCompare(String(bv).toLowerCase()) * dir;
    });
  }

  /**
   * Build the `<thead>` element.
   *
   * @returns {HTMLTableSectionElement}
   */
  _buildHead() {
    const thead = document.createElement('thead');
    const tr = document.createElement('tr');

    for (const col of this._columns) {
      const isSortable = col.sortable !== false; // default true
      const isActive = this._sortKey === col.key;

      const th = document.createElement('th');
      th.setAttribute('role', 'columnheader');
      th.setAttribute('scope', 'col');

      if (isSortable) {
        th.setAttribute('tabindex', '0');

        // aria-sort only on the currently active column; others get "none"
        th.setAttribute('aria-sort', isActive ? this._sortDirection === 'asc' ? 'ascending' : 'descending' : 'none');

        // Label text
        const labelSpan = document.createElement('span');
        labelSpan.textContent = col.label;

        // Sort indicator arrow (always present; CSS hides/shows via aria-sort)
        const indicator = document.createElement('span');
        indicator.className = 'sort-indicator';
        indicator.setAttribute('aria-hidden', 'true');

        th.appendChild(labelSpan);
        th.appendChild(indicator);

        // Click handler
        th.addEventListener('click', () => this._sortBy(col.key));

        // Keyboard: Enter / Space triggers sort (Req 19.4)
        th.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this._sortBy(col.key);
          }
        });
      } else {
        // Non-sortable: no interactivity
        th.textContent = col.label;
      }

      tr.appendChild(th);
    }

    thead.appendChild(tr);
    return thead;
  }

  /**
   * Build the `<tbody>` element from sorted data.
   *
   * @returns {HTMLTableSectionElement}
   */
  _buildBody() {
    const tbody = document.createElement('tbody');
    const sortedData = this._getSortedData();
    const hasRowClick = typeof this._onRowClick === 'function';

    for (const record of sortedData) {
      const tr = document.createElement('tr');

      if (hasRowClick) {
        tr.classList.add('row-clickable');
        tr.addEventListener('click', () => this._onRowClick(record));

        // Keyboard row activation
        tr.setAttribute('tabindex', '0');
        tr.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this._onRowClick(record);
          }
        });
      }

      for (const col of this._columns) {
        const td = document.createElement('td');
        const rawValue = record[col.key] ?? '';

        if (typeof col.render === 'function') {
          // render() may return an HTML string or a plain string
          td.innerHTML = col.render(rawValue, record);
        } else {
          td.textContent = rawValue === null || rawValue === undefined ? '' : String(rawValue);
        }

        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    }

    return tbody;
  }
}

// ─── FormValidator ────────────────────────────────────────────────────────────
/**
 * FormValidator — registers per-field validation rules, runs validation,
 * renders inline error messages, and clears errors.
 *
 * Validators can be:
 *  - Plain functions `(value) => true | errorString`
 *  - Higher-order functions that have already been called and returned a
 *    plain validator (e.g. `validators.maxLength(100)` returns such a function)
 *
 * Usage:
 *   const fv = new FormValidator(formEl);
 *   fv.register('fullName', [validators.required, validators.maxLength(100)]);
 *   fv.register('moodScore', [validators.required, validators.integerRange(1, 10)]);
 *
 *   const { valid, errors } = fv.validate({ fullName: 'Alice', moodScore: 11 });
 *   if (!valid) {
 *     fv.renderErrors(errors);
 *   } else {
 *     fv.clearErrors();
 *   }
 *
 * Requirements: 8.2, 8.3, 8.4, 18.3, 18.4
 */
export class FormValidator {
  /**
   * @param {HTMLFormElement|HTMLElement} formEl - The form element that owns
   *   the fields this validator manages.
   */
  constructor(formEl) {
    this.formEl = formEl;
    /** @type {Record<string, Array<(v: *) => true|string>>} */
    this._rules = {};
  }

  /**
   * Register one or more validators for a named field.
   *
   * Validators are run in the order supplied; validation stops on the first
   * failure and reports that error message.
   *
   * @param {string} name - The `name` attribute of the field to validate.
   * @param {Array<(v: *) => true|string>} validators - Ordered list of
   *   validator functions. Each returns `true` on success or an error string.
   */
  register(name, validators) {
    this._rules[name] = validators;
  }

  /**
   * Run all registered validators against the supplied form data.
   *
   * @param {Record<string, *>} formData - Plain object mapping field names to
   *   their current values.
   * @returns {{ valid: boolean, errors: Record<string, string> }}
   *   `valid` is `true` only when every field passes all its validators.
   *   `errors` maps failing field names to their first error message.
   */
  validate(formData) {
    const errors = {};

    for (const [name, validators] of Object.entries(this._rules)) {
      const value = formData[name];
      for (const validator of validators) {
        const result = validator(value);
        if (result !== true) {
          // result is the error message string
          errors[name] = result;
          break; // stop at first failure for this field
        }
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * Render inline error messages for each failing field.
   *
   * For every field name in `errors`:
   *  1. Locate the input/select/textarea within the form via `[name="fieldName"]`.
   *  2. Set `aria-invalid="true"` on the element.
   *  3. Insert a `<span class="field-error" role="alert" aria-live="assertive">`
   *     element immediately after the input (or after its `.form-group` ancestor
   *     when present, to respect the standard form layout structure).
   *
   * Existing error spans for a field are removed before inserting a new one so
   * that repeated calls do not stack duplicate messages.
   *
   * @param {Record<string, string>} errors - Map of field name → error message,
   *   as returned by `validate()`.
   */
  renderErrors(errors) {
    for (const [name, message] of Object.entries(errors)) {
      const input = this.formEl.querySelector(`[name="${CSS.escape(name)}"]`);
      if (!input) continue;

      // Mark input as invalid for screen readers and CSS styling
      input.setAttribute('aria-invalid', 'true');

      // Remove any pre-existing error span for this field
      const existingSpan = this.formEl.querySelector(
        `.field-error[data-field="${CSS.escape(name)}"]`
      );
      if (existingSpan) {
        existingSpan.remove();
      }

      // Build the error span
      const span = document.createElement('span');
      span.className = 'field-error';
      span.setAttribute('role', 'alert');
      span.setAttribute('aria-live', 'assertive');
      span.setAttribute('data-field', name);
      span.textContent = message;

      // Insert after the input's nearest .form-group ancestor when present,
      // otherwise insert immediately after the input itself.
      const formGroup = input.closest('.form-group');
      if (formGroup) {
        formGroup.appendChild(span);
      } else {
        input.insertAdjacentElement('afterend', span);
      }
    }
  }

  /**
   * Remove all error spans produced by `renderErrors` and reset `aria-invalid`
   * on all inputs within the form.
   */
  clearErrors() {
    // Remove every .field-error span inside the form
    this.formEl.querySelectorAll('.field-error').forEach((span) => {
      span.remove();
    });

    // Reset aria-invalid on all form controls
    this.formEl
      .querySelectorAll('[aria-invalid="true"]')
      .forEach((el) => {
        el.removeAttribute('aria-invalid');
      });
  }
}
