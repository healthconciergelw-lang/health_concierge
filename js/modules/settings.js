/**
 * settings.js — Settings screen module
 *
 * Renders the Settings page with:
 *   - Reference list management (Requirements 17.1–17.6)
 *   - Data export (Requirement 15.1)
 *   - Data import (Requirements 16.1–16.3)
 */

import { store } from '../store.js';
import { db } from '../db.js';
import { ConfirmDialog, Toast, Modal } from '../components.js';
import { exportData } from '../exportImport.js';
import { importData, ImportError } from '../exportImport.js';

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// Reference list rendering
// ---------------------------------------------------------------------------

/**
 * Build the inner HTML for a single reference list's <ul> element.
 *
 * @param {string}   key   - The settings key (e.g. 'commonHabits')
 * @param {string[]} items - The current list values
 * @returns {string} HTML string for the <ul>
 */
function _buildListHTML(key, items) {
  if (!items || items.length === 0) {
    return '<ul class="ref-list"><li class="ref-list-empty">No items yet.</li></ul>';
  }

  const lis = items
    .map(
      (item) => `
      <li class="ref-list-item">
        <span class="ref-list-item-name">${_esc(item)}</span>
        <button
          type="button"
          class="btn btn-sm btn-danger ref-list-delete-btn"
          data-key="${_esc(key)}"
          data-value="${_esc(item)}"
          aria-label="Delete ${_esc(item)}"
          style="flex-shrink:0;min-height:28px;padding:4px 10px;font-size:11px;"
        >Remove</button>
      </li>`
    )
    .join('');

  return `<ul class="ref-list">${lis}</ul>`;
}

/**
 * Build the full HTML for a single reference list card section.
 *
 * @param {object} config  - { key, label }
 * @param {object} settings - The full settings object
 * @returns {string}
 */
function _buildListSectionHTML(config, settings) {
  const items = settings[config.key] ?? [];
  const listHTML = _buildListHTML(config.key, items);

  return `
    <section class="settings-card" data-list-key="${_esc(config.key)}">
      <h3 class="settings-card-title">${_esc(config.label)}</h3>
      <div class="ref-list-container" id="ref-list-container-${_esc(config.key)}">
        ${listHTML}
      </div>
      <div class="ref-list-add-form" role="form" aria-label="Add item to ${_esc(config.label)}">
        <input
          type="text"
          class="ref-list-input"
          id="ref-list-input-${_esc(config.key)}"
          data-key="${_esc(config.key)}"
          placeholder="Add new item…"
          maxlength="50"
          aria-label="New item name for ${_esc(config.label)}"
        >
        <button
          type="button"
          class="btn btn-primary btn-sm ref-list-add-btn"
          data-key="${_esc(config.key)}"
          aria-label="Add item to ${_esc(config.label)}"
          style="flex-shrink:0;"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          Add
        </button>
        <span
          class="ref-list-inline-error field-error"
          id="ref-list-error-${_esc(config.key)}"
          role="alert"
          aria-live="assertive"
          style="display:none;width:100%;margin-top:4px;"
        ></span>
      </div>
    </section>`;
}

// ---------------------------------------------------------------------------
// Public render function
// ---------------------------------------------------------------------------

/**
 * Render the Settings page into `root`.
 *
 * @param {HTMLElement} root   - The container element to render into
 * @param {object}      params - Route params (unused here)
 */
export function render(root, params) {
  // 1. Get settings from store
  const settings = db.getSettings();

  // 2. Define 5 reference list configs
  const listConfigs = [
    { key: 'commonHabits',       label: 'Common Habits' },
    { key: 'supportStyles',      label: 'Support Styles' },
    { key: 'priorityLevels',     label: 'Priority Levels' },
    { key: 'clientStatusValues', label: 'Client Status Values' },
    { key: 'goalStatusValues',   label: 'Goal Status Values' },
  ];

  // 3. Build HTML for each reference list section
  const listSectionsHTML = listConfigs
    .map((cfg) => _buildListSectionHTML(cfg, settings))
    .join('');

  // 4. Build Export section
  const exportSectionHTML = `
    <section class="settings-card" id="settings-export-section">
      <h2 class="settings-card-title">Export Data</h2>
      <p class="settings-section-description">
        Download all your data as a JSON backup file. The file can be re-imported
        on any device running Health Concierge.
      </p>
      <button type="button" class="btn btn-primary" id="settings-export-btn">
        Export Data
      </button>
    </section>`;

  // 5. Build Import section
  const importSectionHTML = `
    <section class="settings-card" id="settings-import-section">
      <h2 class="settings-card-title">Import Data</h2>
      <p class="settings-section-description">
        Restore data from a previously exported JSON file.
        <strong>Warning:</strong> importing will replace <em>all</em> current data.
      </p>
      <label for="settings-import-file" class="btn btn-secondary" style="cursor:pointer;">
        Choose File
      </label>
      <input
        type="file"
        id="settings-import-file"
        accept=".json"
        style="position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;"
        aria-label="Choose a JSON file to import"
      >
    </section>`;

  // 6. Set root.innerHTML with all sections
  root.innerHTML = `
    <div class="settings-page">
      <div class="settings-sections">
        ${listSectionsHTML}
        <section class="settings-card" id="settings-export-section">
          <h3 class="settings-card-title">Export Data</h3>
          <p class="settings-section-description">
            Download all your data as a JSON backup file. You can re-import it on any device.
          </p>
          <button type="button" class="btn btn-primary" id="settings-export-btn">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 2v8m0 0L5 7m3 3l3-3M2 13h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Export Data
          </button>
        </section>
        <section class="settings-card" id="settings-import-section">
          <h3 class="settings-card-title">Import Data</h3>
          <p class="settings-section-description">
            Restore from a backup JSON file. <strong>Warning:</strong> this replaces all current data.
          </p>
          <label for="settings-import-file" class="btn btn-secondary" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 10V2m0 0L5 5m3-3l3 3M2 13h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Choose File
          </label>
          <input
            type="file"
            id="settings-import-file"
            accept=".json"
            style="position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;"
            aria-label="Choose a JSON file to import"
          >
        </section>
      </div>
    </div>`;

  // 7. Wire up all event listeners
  _wireListeners(root, listConfigs);
}

// ---------------------------------------------------------------------------
// Event listener wiring
// ---------------------------------------------------------------------------

/**
 * Wire all event listeners for the settings page.
 *
 * @param {HTMLElement} root
 * @param {Array<{key:string, label:string}>} listConfigs
 */
function _wireListeners(root, listConfigs) {
  // ── Reference list: Add item ─────────────────────────────────────────────
  for (const config of listConfigs) {
    const addBtn = root.querySelector(
      `.ref-list-add-btn[data-key="${CSS.escape(config.key)}"]`
    );
    if (addBtn) {
      addBtn.addEventListener('click', () =>
        _handleAddItem(root, config.key)
      );
    }

    // Also allow pressing Enter inside the input
    const input = root.querySelector(
      `#ref-list-input-${CSS.escape(config.key)}`
    );
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          _handleAddItem(root, config.key);
        }
      });
    }
  }

  // ── Reference list: Delete item (event delegation on root) ───────────────
  root.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.ref-list-delete-btn');
    if (!deleteBtn) return;
    const key   = deleteBtn.dataset.key;
    const value = deleteBtn.dataset.value;
    if (key && value !== undefined) {
      _handleDeleteItem(root, key, value, deleteBtn);
    }
  });

  // ── Export ────────────────────────────────────────────────────────────────
  const exportBtn = root.querySelector('#settings-export-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      exportData(store);
    });
  }

  // ── Import ────────────────────────────────────────────────────────────────
  const importFile = root.querySelector('#settings-import-file');
  if (importFile) {
    importFile.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      _handleImport(root, file, importFile);
    });
  }
}

// ---------------------------------------------------------------------------
// Reference list handlers
// ---------------------------------------------------------------------------

/**
 * Handle "Add" button click for a reference list.
 *
 * @param {HTMLElement} root
 * @param {string}      key  - The list key (e.g. 'commonHabits')
 */
function _handleAddItem(root, key) {
  const input     = root.querySelector(`#ref-list-input-${CSS.escape(key)}`);
  const errorSpan = root.querySelector(`#ref-list-error-${CSS.escape(key)}`);

  if (!input) return;

  const value = input.value;

  // Clear any previous inline error
  if (errorSpan) {
    errorSpan.textContent = '';
    errorSpan.style.display = 'none';
  }

  const result = db.addReferenceItem(key, value);

  if (result.error) {
    // Show inline error, keep the input value
    if (errorSpan) {
      errorSpan.textContent = result.error;
      errorSpan.style.display = 'inline';
    }
    return;
  }

  // Success: clear input, re-render only the affected list <ul>, toast
  input.value = '';
  _refreshList(root, key);
  Toast.show('Item added.', 'success');
}

/**
 * Handle delete button click for a reference list item.
 *
 * @param {HTMLElement} root
 * @param {string}      key
 * @param {string}      value
 * @param {HTMLElement} deleteBtn - The button element (for inline error placement)
 */
async function _handleDeleteItem(root, key, value, deleteBtn) {
  // Clear any previous inline delete error near this button
  const prevErr = deleteBtn.parentElement?.querySelector('.ref-list-delete-error');
  if (prevErr) prevErr.remove();

  const result = db.deleteReferenceItem(key, value);

  if (result.error) {
    // Cannot delete last item — show inline error near the button
    const errSpan = document.createElement('span');
    errSpan.className = 'ref-list-delete-error field-error';
    errSpan.setAttribute('role', 'alert');
    errSpan.textContent = result.error;
    deleteBtn.insertAdjacentElement('afterend', errSpan);
    return;
  }

  if (result.warning) {
    // In-use warning — show confirmation dialog
    const count = result.count;
    const names = result.affectedNames.join(', ');
    const message =
      `This item is assigned to ${count} record${count !== 1 ? 's' : ''}: ${names}. ` +
      `Deleting it will replace the value with "${value} (removed)" in those records. Continue?`;

    const confirmed = await ConfirmDialog.open(message);
    if (!confirmed) return;

    // Confirmed — delete with force
    const confirmResult = db.deleteReferenceItem(key, value, null, { confirmed: true });
    if (confirmResult.success) {
      _refreshList(root, key);
      Toast.show('Item deleted.', 'success');
    }
    return;
  }

  if (result.success) {
    _refreshList(root, key);
    Toast.show('Item deleted.', 'success');
  }
}

// ---------------------------------------------------------------------------
// Import handler
// ---------------------------------------------------------------------------

/**
 * Handle file import flow.
 *
 * @param {HTMLElement}  root
 * @param {File}         file
 * @param {HTMLElement}  fileInput - The file input element (reset after use)
 */
async function _handleImport(root, file, fileInput) {
  const confirmed = await ConfirmDialog.open(
    'This will replace all current data. Continue?'
  );

  // Reset the file input regardless so the same file can be re-selected later
  fileInput.value = '';

  if (!confirmed) return;

  try {
    await importData(file, store);
    Toast.show('Data imported.', 'success');
    // Re-render the entire settings page to reflect new data
    render(root, {});
  } catch (err) {
    if (err instanceof ImportError) {
      Toast.show(err.message, 'error');
    } else {
      Toast.show('Import failed. Please try again.', 'error');
    }
  }
}

// ---------------------------------------------------------------------------
// Partial re-render helper
// ---------------------------------------------------------------------------

/**
 * Re-render only the <ul> for a specific reference list, without touching
 * the rest of the page. This is more efficient than a full re-render.
 *
 * @param {HTMLElement} root
 * @param {string}      key - The list key (e.g. 'commonHabits')
 */
function _refreshList(root, key) {
  const container = root.querySelector(
    `#ref-list-container-${CSS.escape(key)}`
  );
  if (!container) return;

  // Re-read the latest settings from the store
  const settings = db.getSettings();
  const items = settings[key] ?? [];

  container.innerHTML = _buildListHTML(key, items);
}
