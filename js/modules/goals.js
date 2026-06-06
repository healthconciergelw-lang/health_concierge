/**
 * goals.js — Goals module
 *
 * Exports:
 *   render(root, params)                              — top-level router entry point
 *   renderGoalsView(root, clientIdFilter)             — reusable view (also called from Client Profile Goals tab)
 *
 * Requirements: 10.1, 10.2, 10.7, 10.8
 */

import { store } from '../store.js';
import { db } from '../db.js';
import { SortableTable, ConfirmDialog, Toast, Modal, StatusBadge } from '../components.js';
import { formatDate } from '../utils.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Router entry point for the /goals route.
 * Renders all goals across all clients (no client filter).
 *
 * @param {HTMLElement} root
 * @param {object}      _params  Route params (unused)
 */
export function render(root, _params) {
  renderGoalsView(root, null);
}

/**
 * Render the goals view into `root`.
 *
 * When `clientIdFilter` is a non-null client id string, only goals belonging
 * to that client are shown and the "Client" dropdown in the Add Goal form is
 * pre-populated and locked to that client (Requirement 10.6).
 *
 * When `clientIdFilter` is null, all goals across all clients are shown
 * (Requirements 10.1, 10.7).
 *
 * @param {HTMLElement}  root
 * @param {string|null}  clientIdFilter  Client UUID or null for global view
 */
export function renderGoalsView(root, clientIdFilter) {
  // ── 1. Read fresh data ─────────────────────────────────────────────────
  const clients  = store.get('clients');
  const goals    = store.get('goals');
  const settings = store.get('settings');

  // ── 2. Build clientId → fullName lookup map ────────────────────────────
  /** @type {Map<string, string>} */
  const clientNameMap = new Map(clients.map(c => [c.id, c.fullName]));

  // ── 3. Enrich goals with clientName; apply optional client filter ──────
  let rows = goals.map(g => ({
    ...g,
    clientName: clientNameMap.get(g.clientId) ?? '(Unknown client)',
  }));

  if (clientIdFilter !== null && clientIdFilter !== undefined) {
    rows = rows.filter(g => g.clientId === clientIdFilter);
  }

  // ── 4. Status filter options ────────────────────────────────────────────
  const goalStatusValues = settings.goalStatusValues ?? ['Not Started', 'In Progress', 'Complete'];
  const statusOptions = goalStatusValues
    .map(v => `<option value="${_esc(v)}">${_esc(v)}</option>`)
    .join('');

  // ── 5. Render scaffold HTML ─────────────────────────────────────────────
  root.innerHTML = `
    <section class="goals-view" aria-label="Goals">
      <div class="goals-header">
        <h2 class="section-title">Goals</h2>
        <div class="goals-controls">
          <label for="goals-status-filter" class="filter-label">Status</label>
          <select id="goals-status-filter" class="filter-select" aria-label="Filter by goal status">
            <option value="All">All</option>
            ${statusOptions}
          </select>
          <button type="button" id="goals-add-btn" class="btn btn-primary">Add Goal</button>
        </div>
      </div>
      <div id="goals-table-container" class="goals-table-container"></div>
    </section>
  `;

  // ── 6. Column definitions ───────────────────────────────────────────────
  /** @type {Array} */
  const columns = [
    {
      key:   'clientName',
      label: 'Client Name',
    },
    {
      key:   'description',
      label: 'Goal Description',
    },
    {
      key:   'whyItMatters',
      label: 'Why It Matters',
      render: (v) => _esc(v ?? ''),
    },
    {
      key:   'targetDate',
      label: 'Target Date',
      render: (v) => _esc(formatDate(v)),
    },
    {
      key:   'status',
      label: 'Goal Status',
      render: (v, record) => {
        if (!v) return '';
        const badge = StatusBadge.render(v, 'Goal Status');
        return `<button
          type="button"
          class="status-badge-btn goal-status-btn"
          data-id="${_esc(record.id)}"
          data-status="${_esc(v)}"
          aria-label="Change goal status: currently ${_esc(v)}"
          title="Click to change status"
          style="position:relative;"
        >${badge}<span class="status-chevron" aria-hidden="true">▾</span></button>`;
      },
    },
    {
      key:   'completedDate',
      label: 'Completed Date',
      render: (v) => _esc(formatDate(v)),
    },
    {
      key:      '_actions',
      label:    'Actions',
      sortable: false,
      render:   (_v, record) => `
        <div class="row-actions">
          <button
            type="button"
            class="btn btn-sm btn-secondary goal-edit-btn"
            data-id="${_esc(record.id)}"
            aria-label="Edit goal for ${_esc(record.clientName)}"
          >Edit</button>
          <button
            type="button"
            class="btn btn-sm btn-danger goal-delete-btn"
            data-id="${_esc(record.id)}"
            aria-label="Delete goal for ${_esc(record.clientName)}"
          >Delete</button>
        </div>`,
    },
  ];

  // ── 7. Table builder (called on initial render and on filter change) ────
  const tableContainer = root.querySelector('#goals-table-container');

  /** @type {SortableTable|null} */
  let tableInstance = null;

  /** Current status filter value */
  let currentStatusFilter = 'All';

  function buildTable(statusFilter) {
    const filtered = statusFilter === 'All'
      ? rows
      : rows.filter(g => g.status === statusFilter);

    if (tableInstance) {
      tableInstance.update(filtered);
    } else {
      tableInstance = new SortableTable(
        tableContainer,
        columns,
        filtered,
        {
          defaultSort:  { key: 'clientName', direction: 'asc' },
          emptyMessage: 'No goals have been added yet.',
        }
      );
    }
  }

  buildTable('All');

  // ── 8. Status filter wiring ─────────────────────────────────────────────
  const statusSelect = root.querySelector('#goals-status-filter');
  statusSelect.addEventListener('change', () => {
    currentStatusFilter = statusSelect.value;
    buildTable(currentStatusFilter);
  });

  // ── 9. "Add Goal" button ────────────────────────────────────────────────
  root.querySelector('#goals-add-btn').addEventListener('click', () => {
    openGoalForm(null, clientIdFilter, () => renderGoalsView(root, clientIdFilter));
  });

  // ── 10. Edit / Delete delegation via event bubbling ────────────────────
  tableContainer.addEventListener('click', async (e) => {
    const editBtn   = e.target.closest('.goal-edit-btn');
    const deleteBtn = e.target.closest('.goal-delete-btn');
    const statusBtn = e.target.closest('.goal-status-btn');

    // ── Inline status change ──────────────────────────────────────────────
    if (statusBtn) {
      // Close any open popover first
      document.querySelectorAll('.status-popover').forEach(p => p.remove());

      const goalId      = statusBtn.dataset.id;
      const currentStatus = statusBtn.dataset.status;
      const goalStatusValues = store.get('settings').goalStatusValues
        ?? ['Not Started', 'In Progress', 'Complete'];

      const popover = document.createElement('div');
      popover.className = 'status-popover';
      popover.setAttribute('role', 'listbox');
      popover.setAttribute('aria-label', 'Select goal status');

      goalStatusValues.forEach(val => {
        const opt = document.createElement('button');
        opt.type = 'button';
        opt.className = 'status-popover-option' + (val === currentStatus ? ' is-selected' : '');
        opt.setAttribute('role', 'option');
        opt.setAttribute('aria-selected', String(val === currentStatus));
        opt.textContent = val;
        opt.addEventListener('click', (ev) => {
          ev.stopPropagation();
          popover.remove();
          if (val !== currentStatus) {
            const goal = store.get('goals').find(g => g.id === goalId);
            if (goal) {
              db.saveGoal({ ...goal, status: val });
              Toast.show(`Status updated to "${val}".`, 'success');
              renderGoalsView(root, clientIdFilter);
            }
          }
        });
        popover.appendChild(opt);
      });

      // Position relative to button
      statusBtn.style.position = 'relative';
      statusBtn.appendChild(popover);

      // Close on outside click
      const closeHandler = (ev) => {
        if (!statusBtn.contains(ev.target)) {
          popover.remove();
          document.removeEventListener('click', closeHandler, true);
        }
      };
      setTimeout(() => document.addEventListener('click', closeHandler, true), 0);
      return;
    }

    if (editBtn) {
      const goalId = editBtn.dataset.id;
      const goal   = store.get('goals').find(g => g.id === goalId);
      if (goal) {
        openGoalForm(goal, clientIdFilter, () => renderGoalsView(root, clientIdFilter));
      }
      return;
    }

    if (deleteBtn) {
      const goalId = deleteBtn.dataset.id;
      const confirmed = await ConfirmDialog.open(
        'Delete this goal? This action cannot be undone.'
      );
      if (confirmed) {
        db.deleteGoal(goalId);
        Toast.show('Goal deleted.', 'success');
        renderGoalsView(root, clientIdFilter);
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Goal form modal
// ---------------------------------------------------------------------------

/**
 * Open a Modal containing the Add / Edit Goal form.
 *
 * Task 12.2 will flesh out full validation and field wiring; this stub
 * provides a working form shell sufficient for Add and Edit operations.
 *
 * Rules:
 * - When `goalToEdit` is null  → "Add Goal" mode (empty form)
 * - When `goalToEdit` is set   → "Edit Goal" mode (pre-populated form)
 * - When `lockedClientId` is set → Client dropdown is pre-selected and
 *   disabled (profile Goals tab context — Requirement 10.6)
 *
 * @param {object|null}  goalToEdit      Existing goal record, or null for new
 * @param {string|null}  lockedClientId  Pre-select + lock client; null = free choice
 * @param {Function}     onSaved         Callback invoked after a successful save
 */
export function openGoalForm(goalToEdit, lockedClientId, onSaved) {
  const clients  = store.get('clients');
  const settings = store.get('settings');

  const isEdit = goalToEdit !== null && goalToEdit !== undefined;
  const title  = isEdit ? 'Edit Goal' : 'Add Goal';

  // Build <option> elements for the Client dropdown
  const clientOptions = clients
    .map(c => {
      const selected = (
        (isEdit   && c.id === goalToEdit.clientId) ||
        (!isEdit  && lockedClientId && c.id === lockedClientId)
      ) ? 'selected' : '';
      return `<option value="${_esc(c.id)}" ${selected}>${_esc(c.fullName)}</option>`;
    })
    .join('');

  // Build <option> elements for the Goal Status dropdown
  const goalStatusValues = settings.goalStatusValues ?? ['Not Started', 'In Progress', 'Complete'];
  const statusOptions = goalStatusValues
    .map(v => {
      const selected = isEdit && goalToEdit.status === v ? 'selected' : '';
      return `<option value="${_esc(v)}" ${selected}>${_esc(v)}</option>`;
    })
    .join('');

  const disabledAttr = lockedClientId ? 'disabled' : '';

  const bodyHTML = `
    <form id="goal-form" novalidate>
      <div class="form-group">
        <label for="goal-client" class="form-label">
          Client <span aria-hidden="true" class="required-mark">*</span>
        </label>
        <select
          id="goal-client"
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
        <label for="goal-description" class="form-label">
          Goal Description <span aria-hidden="true" class="required-mark">*</span>
        </label>
        <textarea
          id="goal-description"
          name="description"
          class="form-control"
          rows="3"
          maxlength="200"
          required
          aria-required="true"
        >${isEdit ? _esc(goalToEdit.description ?? '') : ''}</textarea>
      </div>

      <div class="form-group">
        <label for="goal-why" class="form-label">Why It Matters</label>
        <textarea
          id="goal-why"
          name="whyItMatters"
          class="form-control"
          rows="3"
          maxlength="500"
        >${isEdit ? _esc(goalToEdit.whyItMatters ?? '') : ''}</textarea>
      </div>

      <div class="form-group">
        <label for="goal-target-date" class="form-label">Target Date</label>
        <input
          type="date"
          id="goal-target-date"
          name="targetDate"
          class="form-control"
          value="${isEdit ? _esc(goalToEdit.targetDate ?? '') : ''}"
        />
      </div>

      <div class="form-group">
        <label for="goal-status" class="form-label">
          Goal Status <span aria-hidden="true" class="required-mark">*</span>
        </label>
        <select
          id="goal-status"
          name="status"
          class="form-control"
          required
          aria-required="true"
        >
          <option value="">— Select status —</option>
          ${statusOptions}
        </select>
      </div>

      <div id="goal-form-errors" role="alert" aria-live="assertive"></div>
    </form>
  `;

  Modal.open(title, bodyHTML, {
    confirmText: isEdit ? 'Save Changes' : 'Add Goal',
    cancelText:  'Cancel',
    showFooter:  true,
    onConfirm:   () => _handleGoalFormSubmit(goalToEdit, lockedClientId, onSaved),
  });
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Read the goal form's current values and attempt to save via db.saveGoal().
 * Performs basic required-field validation; task 12.2 will add full validation.
 *
 * @param {object|null}  goalToEdit
 * @param {string|null}  lockedClientId
 * @param {Function}     onSaved
 */
function _handleGoalFormSubmit(goalToEdit, lockedClientId, onSaved) {
  const form = document.getElementById('goal-form');
  if (!form) return;

  const errorContainer = form.querySelector('#goal-form-errors');

  // Read field values
  const clientIdField  = form.querySelector('[name="clientId"]');
  const descField      = form.querySelector('[name="description"]');
  const whyField       = form.querySelector('[name="whyItMatters"]');
  const targetField    = form.querySelector('[name="targetDate"]');
  const statusField    = form.querySelector('[name="status"]');

  // Resolve clientId — when field is locked (disabled) the browser doesn't
  // include it in a FormData submission, so fall back to lockedClientId.
  const clientId    = (clientIdField  && clientIdField.value)  || lockedClientId  || '';
  const description = descField   ? descField.value.trim()   : '';
  const whyItMatters= whyField    ? whyField.value.trim()    : '';
  const targetDate  = targetField ? targetField.value        : '';
  const status      = statusField ? statusField.value        : '';

  // Validate required fields
  const fieldErrors = [];
  if (!clientId)    fieldErrors.push('Client is required.');
  if (!description) fieldErrors.push('Goal Description is required.');
  if (!status)      fieldErrors.push('Goal Status is required.');

  if (fieldErrors.length > 0) {
    if (errorContainer) {
      errorContainer.innerHTML = fieldErrors
        .map(msg => `<p class="field-error">${_esc(msg)}</p>`)
        .join('');
    }
    // Re-open the modal with the same body so the user can fix errors.
    // Since onConfirm already closed the modal, we must reopen it.
    _reopenFormWithErrors(goalToEdit, lockedClientId, onSaved, fieldErrors);
    return;
  }

  // Build record and save
  const data = {
    ...(goalToEdit ? { id: goalToEdit.id } : {}),
    clientId,
    description,
    whyItMatters: whyItMatters || null,
    targetDate:   targetDate   || null,
    status,
  };

  try {
    db.saveGoal(data);
    Toast.show(goalToEdit ? 'Goal updated.' : 'Goal added.', 'success');
    onSaved();
  } catch (err) {
    console.error('[goals] saveGoal error:', err);
    Toast.show('Failed to save goal. Please try again.', 'error');
  }
}

/**
 * Re-open the goal form after a validation failure so the coach can correct
 * their input. Pre-populates all fields from the attempted submission.
 *
 * @param {object|null} goalToEdit
 * @param {string|null} lockedClientId
 * @param {Function}    onSaved
 * @param {string[]}    errors  Array of error messages to display on open
 */
function _reopenFormWithErrors(goalToEdit, lockedClientId, onSaved, errors) {
  // Use a minimal timeout so the modal close animation completes first.
  setTimeout(() => {
    openGoalForm(goalToEdit, lockedClientId, onSaved);

    // Inject error messages once the new modal's DOM is ready.
    setTimeout(() => {
      const errorContainer = document.getElementById('goal-form-errors');
      if (errorContainer) {
        errorContainer.innerHTML = errors
          .map(msg => `<p class="field-error">${_esc(msg)}</p>`)
          .join('');
      }
    }, 50);
  }, 220); // slightly longer than the Modal.close() 200 ms transition
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
