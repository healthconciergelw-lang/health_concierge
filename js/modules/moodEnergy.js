/**
 * moodEnergy.js — Mood & Energy Check-In module
 *
 * Exports:
 *   render(root, params)                              — top-level router entry point
 *   renderMoodEnergyView(root, clientIdFilter)        — reusable view (also called from Client Profile Mood & Energy tab)
 *   renderTrendChart(container, clientId)             — Chart.js 4.x line chart (Requirements 12.6, 14.1, 14.5)
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.6, 12.7, 12.8, 12.9, 14.1, 14.5
 */

import { store } from '../store.js';
import { db } from '../db.js';
import { SortableTable, ConfirmDialog, Toast, Modal, StatusBadge } from '../components.js';
import { FormValidator } from '../components.js';
import { validators } from '../validation.js';
import { today, formatDate } from '../utils.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Router entry point for the /mood-energy route.
 * Renders all check-ins across all clients (no client filter).
 *
 * @param {HTMLElement} root
 * @param {object}      _params  Route params (unused)
 */
export function render(root, _params) {
  renderMoodEnergyView(root, null);
}

/**
 * Render the Mood & Energy check-in log into `root`.
 *
 * When `clientIdFilter` is a non-null client id string, only check-ins
 * belonging to that client are shown and the Client field in the Add
 * Check-In form is pre-populated and locked (Requirement 12.5).
 *
 * When `clientIdFilter` is null, all check-ins across all clients are shown
 * plus an optional client-filter select for trend chart display (Requirement 12.6).
 *
 * @param {HTMLElement}  root
 * @param {string|null}  clientIdFilter  Client UUID or null for global view
 */
export function renderMoodEnergyView(root, clientIdFilter) {
  // ── 1. Read fresh data ─────────────────────────────────────────────────
  const clients  = store.get('clients');
  const checkIns = store.get('checkIns');

  // ── 2. Build clientId → fullName lookup map ────────────────────────────
  /** @type {Map<string, string>} */
  const clientNameMap = new Map(clients.map(c => [c.id, c.fullName]));

  // ── 3. Enrich check-ins with clientName; apply optional client filter ──
  let rows = checkIns.map(ci => ({
    ...ci,
    clientName: clientNameMap.get(ci.clientId) ?? '(Unknown client)',
  }));

  if (clientIdFilter !== null && clientIdFilter !== undefined) {
    rows = rows.filter(ci => ci.clientId === clientIdFilter);
  }

  // ── 4. Build client filter select HTML (shown only on global view) ─────
  const activeClients = clients.filter(c => c.status === 'Active');
  const clientFilterHTML = (clientIdFilter === null || clientIdFilter === undefined)
    ? `
      <div class="filter-group">
        <label for="mood-client-filter" class="filter-label">Client</label>
        <select id="mood-client-filter" class="filter-select" aria-label="Filter by client">
          <option value="">— All Clients —</option>
          ${clients.map(c => `<option value="${_esc(c.id)}">${_esc(c.fullName)}</option>`).join('')}
        </select>
      </div>`
    : '';

  // ── 5. Render scaffold HTML ─────────────────────────────────────────────
  root.innerHTML = `
    <section class="mood-energy-view" aria-label="Mood &amp; Energy">
      <div class="mood-energy-header">
        <h2 class="section-title">Mood &amp; Energy</h2>
        <div class="mood-energy-controls">
          ${clientFilterHTML}
          <button type="button" id="mood-add-btn" class="btn btn-primary">Add Check-In</button>
        </div>
      </div>
      <div id="trend-chart-container" class="trend-chart-container" style="display:none;"></div>
      <div id="mood-table-container" class="mood-table-container"></div>
    </section>
  `;

  // ── 6. Column definitions ───────────────────────────────────────────────
  const columns = [
    {
      key:   'clientName',
      label: 'Client Name',
    },
    {
      key:   'date',
      label: 'Date',
      render: (v) => _esc(formatDate(v)),
    },
    {
      key:   'moodScore',
      label: 'Mood Score',
    },
    {
      key:   'energyScore',
      label: 'Energy Score',
    },
    {
      key:   'notes',
      label: 'Notes',
      render: (v) => {
        if (!v) return '';
        const truncated = v.length > 50 ? v.slice(0, 50) + '…' : v;
        return _esc(truncated);
      },
    },
    {
      key:      '_actions',
      label:    'Actions',
      sortable: false,
      render:   (_v, record) => `
        <div class="row-actions">
          <button
            type="button"
            class="btn btn-sm btn-secondary checkin-edit-btn"
            data-id="${_esc(record.id)}"
            aria-label="Edit check-in for ${_esc(record.clientName)}"
          >Edit</button>
          <button
            type="button"
            class="btn btn-sm btn-danger checkin-delete-btn"
            data-id="${_esc(record.id)}"
            aria-label="Delete check-in for ${_esc(record.clientName)}"
          >Delete</button>
        </div>`,
    },
  ];

  // ── 7. Render initial table ─────────────────────────────────────────────
  const tableContainer = root.querySelector('#mood-table-container');

  new SortableTable(
    tableContainer,
    columns,
    rows,
    {
      defaultSort:  { key: 'date', direction: 'desc' },
      emptyMessage: 'No check-ins have been recorded yet.',
    }
  );

  // ── 8. "Add Check-In" button ────────────────────────────────────────────
  root.querySelector('#mood-add-btn').addEventListener('click', () => {
    openCheckInForm(null, clientIdFilter, () => renderMoodEnergyView(root, clientIdFilter));
  });

  // ── 9. Edit / Delete delegation via event bubbling ──────────────────────
  tableContainer.addEventListener('click', async (e) => {
    const editBtn   = e.target.closest('.checkin-edit-btn');
    const deleteBtn = e.target.closest('.checkin-delete-btn');

    if (editBtn) {
      const checkInId = editBtn.dataset.id;
      const checkIn   = store.get('checkIns').find(ci => ci.id === checkInId);
      if (checkIn) {
        openCheckInForm(checkIn, clientIdFilter, () => renderMoodEnergyView(root, clientIdFilter));
      }
      return;
    }

    if (deleteBtn) {
      const checkInId = deleteBtn.dataset.id;
      const confirmed = await ConfirmDialog.open(
        'Delete this check-in? This action cannot be undone.'
      );
      if (confirmed) {
        db.deleteCheckIn(checkInId);
        Toast.show('Check-in deleted.', 'success');
        renderMoodEnergyView(root, clientIdFilter);
      }
    }
  });

  // ── 10. Client filter select → show/hide trend chart (global view only) ─
  if (clientIdFilter === null || clientIdFilter === undefined) {
    const clientFilterSelect = root.querySelector('#mood-client-filter');
    const trendContainer     = root.querySelector('#trend-chart-container');

    if (clientFilterSelect) {
      clientFilterSelect.addEventListener('change', () => {
        const selectedClientId = clientFilterSelect.value;
        if (!selectedClientId) {
          trendContainer.style.display = 'none';
          trendContainer.innerHTML = '';
        } else {
          trendContainer.style.display = '';
          renderTrendChart(trendContainer, selectedClientId);
        }
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Check-In form modal
// ---------------------------------------------------------------------------

/**
 * Open a Modal containing the Add / Edit Check-In form.
 *
 * Rules:
 * - When `checkInToEdit` is null  → "Add Check-In" mode (empty form)
 * - When `checkInToEdit` is set   → "Edit Check-In" mode (pre-populated form)
 * - When `lockedClientId` is set  → Client dropdown pre-populated and locked
 *   (profile Mood & Energy tab context — Requirement 12.5)
 *
 * @param {object|null}  checkInToEdit   Existing check-in record, or null for new
 * @param {string|null}  lockedClientId  Pre-select + lock client; null = free choice
 * @param {Function}     onSaved         Callback invoked after a successful save
 */
export function openCheckInForm(checkInToEdit, lockedClientId, onSaved) {
  const clients    = store.get('clients');
  const activeClients = clients.filter(c => c.status === 'Active');

  const isEdit = checkInToEdit !== null && checkInToEdit !== undefined;
  const title  = isEdit ? 'Edit Check-In' : 'Add Check-In';

  // When editing, the existing clientId may belong to an inactive client —
  // include it in the dropdown even if not Active so it can be displayed.
  let dropdownClients = activeClients;
  if (isEdit && checkInToEdit.clientId) {
    const editedClient = clients.find(c => c.id === checkInToEdit.clientId);
    if (editedClient && !dropdownClients.some(c => c.id === editedClient.id)) {
      dropdownClients = [editedClient, ...dropdownClients];
    }
  }

  // Build <option> elements for the Client dropdown
  const clientOptions = dropdownClients
    .map(c => {
      const selected = (
        (isEdit  && c.id === checkInToEdit.clientId) ||
        (!isEdit && lockedClientId && c.id === lockedClientId)
      ) ? 'selected' : '';
      return `<option value="${_esc(c.id)}" ${selected}>${_esc(c.fullName)}</option>`;
    })
    .join('');

  const disabledAttr = lockedClientId ? 'disabled' : '';

  const defaultDate    = isEdit ? _esc(checkInToEdit.date ?? today()) : today();
  const defaultMood    = isEdit ? _esc(String(checkInToEdit.moodScore ?? '')) : '';
  const defaultEnergy  = isEdit ? _esc(String(checkInToEdit.energyScore ?? '')) : '';
  const defaultNotes   = isEdit ? _esc(checkInToEdit.notes ?? '') : '';

  const bodyHTML = `
    <form id="checkin-form" novalidate>
      <div class="form-group">
        <label for="checkin-client" class="form-label">
          Client <span aria-hidden="true" class="required-mark">*</span>
        </label>
        <select
          id="checkin-client"
          name="clientId"
          class="form-control"
          required
          ${disabledAttr}
          aria-required="true"
        >
          <option value="">— Select a client —</option>
          ${clientOptions}
        </select>
      </div>

      <div class="form-group">
        <label for="checkin-date" class="form-label">
          Date <span aria-hidden="true" class="required-mark">*</span>
        </label>
        <input
          type="date"
          id="checkin-date"
          name="date"
          class="form-control"
          value="${defaultDate}"
          required
          aria-required="true"
        />
      </div>

      <div class="form-group">
        <label for="checkin-mood" class="form-label">
          Mood Score <span aria-hidden="true" class="required-mark">*</span>
        </label>
        <input
          type="number"
          id="checkin-mood"
          name="moodScore"
          class="form-control"
          min="1"
          max="10"
          step="1"
          value="${defaultMood}"
          placeholder="1–10"
          required
          aria-required="true"
        />
      </div>

      <div class="form-group">
        <label for="checkin-energy" class="form-label">
          Energy Score <span aria-hidden="true" class="required-mark">*</span>
        </label>
        <input
          type="number"
          id="checkin-energy"
          name="energyScore"
          class="form-control"
          min="1"
          max="10"
          step="1"
          value="${defaultEnergy}"
          placeholder="1–10"
          required
          aria-required="true"
        />
      </div>

      <div class="form-group">
        <label for="checkin-notes" class="form-label">Notes</label>
        <textarea
          id="checkin-notes"
          name="notes"
          class="form-control"
          rows="3"
          maxlength="500"
          placeholder="Optional (max 500 characters)"
        >${defaultNotes}</textarea>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary" id="checkin-submit-btn">
          ${isEdit ? 'Save Changes' : 'Add Check-In'}
        </button>
        <button type="button" class="btn btn-secondary" id="checkin-cancel-btn">Cancel</button>
      </div>
    </form>
  `;

  Modal.open(title, bodyHTML, { showFooter: false });

  // Wire up form after the modal's DOM is in place
  // Use requestAnimationFrame to ensure the modal body is inserted
  requestAnimationFrame(() => {
    const form = document.getElementById('checkin-form');
    if (!form) return;

    // Cancel button
    const cancelBtn = form.querySelector('#checkin-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => Modal.close());
    }

    // FormValidator setup
    const fv = new FormValidator(form);
    fv.register('clientId',   [validators.required]);
    fv.register('date',       [validators.required]);
    fv.register('moodScore',  [validators.required, validators.integerRange(1, 10)]);
    fv.register('energyScore',[validators.required, validators.integerRange(1, 10)]);
    fv.register('notes',      [validators.maxLength(500)]);

    // Submit handler
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      _handleCheckInFormSubmit(form, fv, checkInToEdit, lockedClientId, onSaved);
    });
  });
}

// ---------------------------------------------------------------------------
// Trend chart (Requirements 12.6, 12.7, 14.1, 14.5)
// ---------------------------------------------------------------------------

/**
 * Render the mood/energy trend chart for a specific client using Chart.js 4.x.
 *
 * Requirement 12.6: Date on X-axis, Score (1–10) on Y-axis, two line series:
 *   Mood Score (#2C7A7B) and Energy Score (#38A169).
 * Requirement 12.7 / 14.5: Show "Insufficient data" message when fewer than
 *   2 check-ins are available for the client.
 * Requirement 14.1: Chart.js line chart with accessible aria-label + role="img".
 *
 * @param {HTMLElement} container  The container element to render into
 * @param {string}      clientId   The UUID of the client to chart
 */
export function renderTrendChart(container, clientId) {
  const clients  = store.get('clients');
  const clientNameMap = new Map(clients.map(c => [c.id, c.fullName]));
  const clientName = clientNameMap.get(clientId) ?? 'Client';

  // Fetch this client's check-ins and sort ascending by date
  const checkIns = store.get('checkIns')
    .filter(ci => ci.clientId === clientId)
    .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

  // Requirements 12.7, 14.5 — need at least 2 check-ins to draw a meaningful line
  if (checkIns.length < 2) {
    container.innerHTML = '<p class="chart-empty">Insufficient data for chart. At least 2 check-ins required.</p>';
    return;
  }

  // Build the canvas element with accessibility attributes
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', `Mood and Energy trend for ${clientName}`);
  canvas.setAttribute('role', 'img');

  container.innerHTML = '';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');

  // Render Chart.js 4.x line chart
  // Chart is expected to be loaded as a global (window.Chart) via a <script> tag in index.html
  // eslint-disable-next-line no-undef
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: checkIns.map(ci => ci.date),
      datasets: [
        {
          label: 'Mood Score',
          data: checkIns.map(ci => ci.moodScore),
          borderColor: '#2C7A7B',
          tension: 0.3,
        },
        {
          label: 'Energy Score',
          data: checkIns.map(ci => ci.energyScore),
          borderColor: '#38A169',
          tension: 0.3,
        },
      ],
    },
    options: {
      scales: {
        y: { min: 1, max: 10 },
      },
      plugins: {
        legend: { display: true },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Read the check-in form's current values, run validation, and save via
 * db.saveCheckIn() on success.
 *
 * @param {HTMLFormElement} form
 * @param {FormValidator}   fv
 * @param {object|null}     checkInToEdit
 * @param {string|null}     lockedClientId
 * @param {Function}        onSaved
 */
function _handleCheckInFormSubmit(form, fv, checkInToEdit, lockedClientId, onSaved) {
  // Read field values
  const clientIdField   = form.querySelector('[name="clientId"]');
  const dateField       = form.querySelector('[name="date"]');
  const moodField       = form.querySelector('[name="moodScore"]');
  const energyField     = form.querySelector('[name="energyScore"]');
  const notesField      = form.querySelector('[name="notes"]');

  // Resolve clientId — disabled selects are excluded from form submission,
  // so fall back to lockedClientId when the field is locked.
  const clientId   = (clientIdField && clientIdField.value) || lockedClientId || '';
  const date       = dateField    ? dateField.value.trim()    : '';
  const moodRaw    = moodField    ? moodField.value.trim()    : '';
  const energyRaw  = energyField  ? energyField.value.trim()  : '';
  const notes      = notesField   ? notesField.value.trim()   : '';

  // Convert scores to numbers for validation (integerRange expects a Number)
  const moodScore   = moodRaw   !== '' ? Number(moodRaw)   : moodRaw;
  const energyScore = energyRaw !== '' ? Number(energyRaw) : energyRaw;

  // Run FormValidator
  fv.clearErrors();
  const { valid, errors } = fv.validate({
    clientId,
    date,
    moodScore,
    energyScore,
    notes,
  });

  if (!valid) {
    fv.renderErrors(errors);
    return; // Keep modal open so user can fix errors
  }

  // Build record and save
  const data = {
    ...(checkInToEdit ? { id: checkInToEdit.id } : {}),
    clientId,
    date,
    moodScore,
    energyScore,
    notes: notes || null,
  };

  try {
    db.saveCheckIn(data);
    Toast.show('Check-in saved.', 'success');
    Modal.close();
    onSaved();
  } catch (err) {
    console.error('[moodEnergy] saveCheckIn error:', err);
    Toast.show('Failed to save check-in. Please try again.', 'error');
  }
}

/**
 * Minimal HTML-escape for values inserted into innerHTML.
 *
 * @param {string} str
 * @returns {string}
 */
function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
