/**
 * clients.js — Clients module
 *
 * Exports:
 *   render(root, params)        — Renders the full clients roster screen
 *   openClientForm(client, cb)  — Opens add/edit client form modal
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7,
 *               8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 18.3, 18.4
 */

import { store } from '../store.js';
import { db } from '../db.js';
import { validators } from '../validation.js';
import { Modal, ConfirmDialog, Toast, SortableTable, FormValidator, StatusBadge } from '../components.js';
import { formatDate } from '../utils.js';

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Minimal HTML-escape for values inserted into innerHTML.
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

/**
 * Filter clients by fullName containing the query string (case-insensitive).
 * @param {object[]} clients
 * @param {string} query
 * @returns {object[]}
 */
function _filterClients(clients, query) {
  if (!query || !query.trim()) return clients;
  const lower = query.trim().toLowerCase();
  return clients.filter((c) =>
    c.fullName.toLowerCase().includes(lower)
  );
}

// ---------------------------------------------------------------------------
// Roster render
// Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
// ---------------------------------------------------------------------------

/**
 * Render the clients roster screen into `root`.
 *
 * @param {HTMLElement} root    - The `<main id="app-root">` element.
 * @param {object}      _params - Route params (unused).
 */
export function render(root, _params) {
  const clients = store.get('clients');

  root.innerHTML = `
    <section class="clients-screen" aria-label="Clients">
      <div class="screen-header">
        <h1 class="screen-title">Clients</h1>
        <button type="button" class="btn btn-primary" id="add-client-btn">
          Add Client
        </button>
      </div>

      <div class="search-bar">
        <label for="client-search" class="sr-only">Search clients by name</label>
        <input
          type="search"
          id="client-search"
          class="input search-input"
          placeholder="Search by name…"
          aria-label="Search clients by name"
        />
      </div>

      <div id="clients-table-container"></div>
    </section>
  `;

  const tableContainer = root.querySelector('#clients-table-container');
  const searchInput = root.querySelector('#client-search');
  const addBtn = root.querySelector('#add-client-btn');

  let searchQuery = '';
  let tableInstance = null;

  // Column definitions
  const columns = [
    { key: 'fullName', label: 'Name' },
    { key: 'clientId', label: 'Client ID' },
    {
      key: 'priorityLevel',
      label: 'Priority Level',
      render: (v) => v ? StatusBadge.render(v, 'Priority') : '',
    },
    {
      key: 'status',
      label: 'Client Status',
      render: (v) => v ? StatusBadge.render(v, 'Client Status') : '',
    },
    {
      key: 'nextAppointment',
      label: 'Next Appointment',
      render: (v) => v ? _esc(formatDate(v)) : '—',
    },
    {
      key: '_actions',
      label: 'Actions',
      sortable: false,
      render: (_v, record) => `
        <div class="row-actions">
          <button type="button" class="btn btn-sm btn-secondary action-view"
            data-id="${_esc(record.id)}" aria-label="View ${_esc(record.fullName)}">
            View
          </button>
          <button type="button" class="btn btn-sm btn-secondary action-edit"
            data-id="${_esc(record.id)}" aria-label="Edit ${_esc(record.fullName)}">
            Edit
          </button>
          <button type="button" class="btn btn-sm btn-danger action-delete"
            data-id="${_esc(record.id)}" aria-label="Delete ${_esc(record.fullName)}">
            Delete
          </button>
        </div>
      `,
    },
  ];

  /** Build or update the SortableTable from current data + query. */
  function buildTable() {
    const filtered = _filterClients(clients, searchQuery);
    const emptyMsg = searchQuery
      ? 'No clients match the search.'
      : 'No clients have been added yet. Click "Add Client" to get started.';

    if (tableInstance) {
      tableInstance.update(filtered);
    } else {
      tableInstance = new SortableTable(
        tableContainer,
        columns,
        filtered,
        {
          defaultSort: { key: 'fullName', direction: 'asc' },
          emptyMessage: emptyMsg,
        }
      );
    }
  }

  /** Wire action button clicks via event delegation on the table container. */
  function wireActions() {
    tableContainer.addEventListener('click', async (e) => {
      const viewBtn = e.target.closest('.action-view');
      const editBtn = e.target.closest('.action-edit');
      const deleteBtn = e.target.closest('.action-delete');

      if (viewBtn) {
        const id = viewBtn.dataset.id;
        location.hash = `#/clients/${id}`;
        return;
      }

      if (editBtn) {
        const id = editBtn.dataset.id;
        const client = db.getClientById(id);
        if (client) {
          openClientForm(client, () => {
            // Re-render the table in-place after save
            const updated = store.get('clients');
            tableInstance.update(_filterClients(updated, searchQuery));
          });
        }
        return;
      }

      if (deleteBtn) {
        const id = deleteBtn.dataset.id;
        const client = db.getClientById(id);
        if (!client) return;
        const confirmed = await ConfirmDialog.open(
          `Permanently delete "${client.fullName}" and all associated records? This cannot be undone.`
        );
        if (confirmed) {
          db.deleteClient(id);
          Toast.show(`${client.fullName} has been deleted.`, 'success');
          // Remove from local array and re-render
          const idx = clients.findIndex((c) => c.id === id);
          if (idx !== -1) clients.splice(idx, 1);
          tableInstance.update(_filterClients(clients, searchQuery));
        }
        return;
      }
    });
  }

  buildTable();
  wireActions();

  // Debounced search
  let searchTimer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchQuery = searchInput.value;
      buildTable();
    }, 300);
  });

  // Add Client button
  addBtn.addEventListener('click', () => {
    openClientForm(null, () => {
      const updated = store.get('clients');
      clients.length = 0;
      clients.push(...updated);
      tableInstance.update(_filterClients(clients, searchQuery));
    });
  });
}

// ---------------------------------------------------------------------------
// openClientForm — Add / Edit client form
// Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 18.3, 18.4
// ---------------------------------------------------------------------------

/**
 * Open the client add/edit form in a modal.
 *
 * @param {object|null} clientToEdit - Existing client record to edit, or null for new.
 * @param {Function}    onSaved      - Callback invoked after a successful save (before modal close).
 */
export function openClientForm(clientToEdit, onSaved) {
  const isEdit = clientToEdit !== null && clientToEdit !== undefined;

  // ── 1. Load settings for dropdown options ──────────────────────────────
  const settings = store.get('settings');
  const priorityLevels    = settings.priorityLevels    || ['High', 'Medium', 'Low'];
  const clientStatusValues = settings.clientStatusValues || ['Active', 'Inactive', 'Graduated'];
  const supportStyles     = settings.supportStyles     || ['Weekly Check-In', 'Bi-Weekly Check-In', 'Monthly Review'];

  // ── 2. Build dropdown option HTML helpers ──────────────────────────────
  function _options(list, selected) {
    return list
      .map((v) => `<option value="${_esc(v)}"${selected === v ? ' selected' : ''}>${_esc(v)}</option>`)
      .join('');
  }

  // Pre-populate values when editing
  const v = clientToEdit || {};

  // ── 3. Build form HTML ─────────────────────────────────────────────────
  const formHTML = `
    <form id="client-form" novalidate autocomplete="off">

      <!-- Full Name -->
      <div class="form-group">
        <label for="cf-fullName" class="form-label">
          Full Name <span class="required-indicator" aria-hidden="true">*</span>
        </label>
        <input
          type="text"
          id="cf-fullName"
          name="fullName"
          class="input"
          maxlength="100"
          required
          aria-required="true"
          value="${_esc(v.fullName || '')}"
        />
      </div>

      <!-- Client ID -->
      <div class="form-group">
        <label for="cf-clientId" class="form-label">
          Client ID <span class="required-indicator" aria-hidden="true">*</span>
        </label>
        <input
          type="text"
          id="cf-clientId"
          name="clientId"
          class="input"
          maxlength="50"
          required
          aria-required="true"
          value="${_esc(v.clientId || '')}"
          ${isEdit ? 'readonly aria-readonly="true"' : ''}
        />
        ${isEdit ? '<p class="field-hint">Client ID cannot be changed after creation.</p>' : ''}
      </div>

      <!-- Start Weight -->
      <div class="form-group">
        <label for="cf-startWeight" class="form-label">
          Start Weight (lbs) <span class="required-indicator" aria-hidden="true">*</span>
        </label>
        <input
          type="number"
          id="cf-startWeight"
          name="startWeight"
          class="input"
          step="0.1"
          min="1"
          max="2000"
          required
          aria-required="true"
          value="${v.startWeight !== undefined && v.startWeight !== null ? _esc(String(v.startWeight)) : ''}"
        />
      </div>

      <!-- Current Weight -->
      <div class="form-group">
        <label for="cf-currentWeight" class="form-label">
          Current Weight (lbs) <span class="required-indicator" aria-hidden="true">*</span>
        </label>
        <input
          type="number"
          id="cf-currentWeight"
          name="currentWeight"
          class="input"
          step="0.1"
          min="1"
          max="2000"
          required
          aria-required="true"
          value="${v.currentWeight !== undefined && v.currentWeight !== null ? _esc(String(v.currentWeight)) : ''}"
        />
      </div>

      <!-- Next Appointment -->
      <div class="form-group">
        <label for="cf-nextAppointment" class="form-label">
          Next Appointment
        </label>
        <input
          type="date"
          id="cf-nextAppointment"
          name="nextAppointment"
          class="input"
          value="${_esc(v.nextAppointment || '')}"
        />
      </div>

      <!-- Priority Level -->
      <div class="form-group">
        <label for="cf-priorityLevel" class="form-label">
          Priority Level <span class="required-indicator" aria-hidden="true">*</span>
        </label>
        <select
          id="cf-priorityLevel"
          name="priorityLevel"
          class="input select"
          required
          aria-required="true"
        >
          <option value="">— Select —</option>
          ${_options(priorityLevels, v.priorityLevel || '')}
        </select>
      </div>

      <!-- Client Status -->
      <div class="form-group">
        <label for="cf-clientStatus" class="form-label">
          Client Status <span class="required-indicator" aria-hidden="true">*</span>
        </label>
        <select
          id="cf-clientStatus"
          name="clientStatus"
          class="input select"
          required
          aria-required="true"
        >
          <option value="">— Select —</option>
          ${_options(clientStatusValues, v.status || '')}
        </select>
      </div>

      <!-- Support Style -->
      <div class="form-group">
        <label for="cf-supportStyle" class="form-label">
          Support Style <span class="required-indicator" aria-hidden="true">*</span>
        </label>
        <select
          id="cf-supportStyle"
          name="supportStyle"
          class="input select"
          required
          aria-required="true"
        >
          <option value="">— Select —</option>
          ${_options(supportStyles, v.supportStyle || '')}
        </select>
      </div>

      <!-- Form footer: submit inside the form (not modal footer) -->
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="cf-cancel-btn">
          Cancel
        </button>
        <button type="submit" class="btn btn-primary" id="cf-submit-btn">
          ${isEdit ? 'Save Changes' : 'Add Client'}
        </button>
      </div>

    </form>
  `;

  // ── 4. Open modal with showFooter: false (we have our own submit button) ─
  const title = isEdit ? `Edit Client — ${_esc(clientToEdit.fullName)}` : 'Add Client';

  Modal.open(title, formHTML, {
    showFooter: false,
  });

  // ── 5. Get form element reference after modal injects HTML ─────────────
  const formEl = document.getElementById('client-form');
  if (!formEl) return;

  // ── 6. Build FormValidator ─────────────────────────────────────────────
  const fv = new FormValidator(formEl);

  // Gather existing client IDs (excluding the one being edited)
  const existingIds = store.get('clients').map((c) => c.clientId);
  const currentClientId = isEdit ? clientToEdit.clientId : null;

  fv.register('fullName', [
    validators.required,
    validators.maxLength(100),
  ]);

  fv.register('clientId', [
    validators.required,
    validators.maxLength(50),
    validators.clientIdFormat,
    validators.uniqueClientId(existingIds, currentClientId),
  ]);

  fv.register('startWeight', [
    validators.required,
    validators.numeric,
    validators.range(1, 2000),
  ]);

  fv.register('currentWeight', [
    validators.required,
    validators.numeric,
    validators.range(1, 2000),
  ]);

  fv.register('nextAppointment', [
    validators.notPastDate,
  ]);

  fv.register('priorityLevel', [
    validators.required,
  ]);

  fv.register('clientStatus', [
    validators.required,
  ]);

  fv.register('supportStyle', [
    validators.required,
  ]);

  // ── 7. Cancel button ───────────────────────────────────────────────────
  const cancelBtn = document.getElementById('cf-cancel-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      Modal.close();
    });
  }

  // ── 8. Submit handler ──────────────────────────────────────────────────
  formEl.addEventListener('submit', (e) => {
    e.preventDefault();
    fv.clearErrors();

    // Collect form data
    const rawData = new FormData(formEl);
    const formData = {
      fullName:         rawData.get('fullName')?.trim() || '',
      clientId:         rawData.get('clientId')?.trim() || '',
      startWeight:      rawData.get('startWeight'),
      currentWeight:    rawData.get('currentWeight'),
      nextAppointment:  rawData.get('nextAppointment') || null,
      priorityLevel:    rawData.get('priorityLevel'),
      clientStatus:     rawData.get('clientStatus'),
      supportStyle:     rawData.get('supportStyle'),
    };

    // Validate
    const { valid, errors } = fv.validate(formData);

    if (!valid) {
      fv.renderErrors(errors);
      // Focus first error field for accessibility
      const firstErrorField = Object.keys(errors)[0];
      const firstInput = formEl.querySelector(`[name="${CSS.escape(firstErrorField)}"]`);
      if (firstInput) firstInput.focus();
      return;
    }

    // Build the record to save
    const record = {
      ...(isEdit ? { id: clientToEdit.id } : {}),
      clientId:        formData.clientId,
      fullName:        formData.fullName,
      startWeight:     parseFloat(formData.startWeight),
      currentWeight:   parseFloat(formData.currentWeight),
      nextAppointment: formData.nextAppointment || null,
      priorityLevel:   formData.priorityLevel,
      status:          formData.clientStatus,
      supportStyle:    formData.supportStyle,
    };

    // Attempt save
    try {
      db.saveClient(record);
    } catch (err) {
      // Handle duplicate clientId thrown by db.saveClient
      if (err && err.field === 'clientId') {
        fv.renderErrors({ clientId: err.message });
        const clientIdInput = formEl.querySelector('[name="clientId"]');
        if (clientIdInput) clientIdInput.focus();
      } else {
        // Generic save failure — show toast, stay on form
        Toast.show('The record could not be saved. Please try again.', 'error');
      }
      return;
    }

    // Success
    if (typeof onSaved === 'function') {
      onSaved();
    }
    Modal.close();
    Toast.show('Client saved successfully.', 'success');
  });
}
