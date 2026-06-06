/**
 * followUps.js — Follow-Up Notes module
 *
 * Exports:
 *   render(root, params)                                — top-level router entry point
 *   renderFollowUpsView(root, clientIdFilter)           — reusable view (also called from Client Profile)
 *   openFollowUpForm(noteToEdit, lockedClientId, onSaved) — add / edit form modal
 *
 * Requirements: 13.1–13.8, 14.1
 */

import { store } from '../store.js';
import { db } from '../db.js';
import { SortableTable, ConfirmDialog, Toast, Modal } from '../components.js';
import { FormValidator } from '../components.js';
import { validators } from '../validation.js';
import { today, formatDate } from '../utils.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Router entry point for the /follow-ups route.
 * Shows all follow-up notes across all clients (no client filter).
 *
 * @param {HTMLElement} root
 * @param {object}      _params  Route params (unused)
 */
export function render(root, _params) {
  renderFollowUpsView(root, null);
}

/**
 * Render the Follow-Up Notes view into `root`.
 *
 * When `clientIdFilter` is a non-null client UUID string, only notes belonging
 * to that client are shown and the search bar is hidden (profile tab context).
 *
 * When `clientIdFilter` is null, all notes across all clients are shown along
 * with a live search bar.
 *
 * @param {HTMLElement}  root
 * @param {string|null}  clientIdFilter  Client UUID or null for global view
 */
export function renderFollowUpsView(root, clientIdFilter) {
  // ── 1. Read data from store ─────────────────────────────────────────────
  const clients       = store.get('clients');
  const followUpNotes = store.get('followUpNotes');

  // ── 2. Build clientId → fullName lookup map ─────────────────────────────
  /** @type {Map<string, string>} */
  const clientNameMap = new Map(clients.map(c => [c.id, c.fullName]));

  // ── 3. Apply optional client filter & enrich with clientName ───────────
  let notes = followUpNotes.map(n => ({
    ...n,
    clientName: clientNameMap.get(n.clientId) ?? '(Unknown client)',
  }));

  if (clientIdFilter !== null && clientIdFilter !== undefined) {
    notes = notes.filter(n => n.clientId === clientIdFilter);
  }

  // ── 4. Build rows with preview (first 100 chars + ellipsis if truncated) ─
  const rows = notes.map(n => ({
    ...n,
    preview: n.noteText && n.noteText.length > 100
      ? n.noteText.slice(0, 100) + '…'
      : (n.noteText ?? ''),
  }));

  // ── 5. Render scaffold HTML ─────────────────────────────────────────────
  const isGlobalView = clientIdFilter === null || clientIdFilter === undefined;
  const searchHTML = isGlobalView
    ? `<div class="search-group">
         <input
           type="search"
           id="followups-search"
           class="form-control"
           placeholder="Search by client or note..."
           aria-label="Search follow-up notes"
         />
       </div>`
    : '';

  root.innerHTML = `
    <section class="followups-view" aria-label="Follow-Up Notes">
      <div class="followups-header">
        <h2 class="section-title">Follow-Up Notes</h2>
        <div class="followups-controls">
          ${searchHTML}
          <button type="button" id="followup-add-btn" class="btn btn-primary">Add Note</button>
        </div>
      </div>
      <div id="followups-table-container" class="followups-table-container"></div>
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
      key:   'preview',
      label: 'Note Preview',
      render: (v) => _esc(v),
    },
    {
      key:      '_actions',
      label:    'Actions',
      sortable: false,
      render:   (_v, record) => `
        <div class="row-actions">
          <button
            type="button"
            class="btn btn-sm btn-secondary followup-edit-btn"
            data-id="${_esc(record.id)}"
            aria-label="Edit note for ${_esc(record.clientName)}"
          >Edit</button>
          <button
            type="button"
            class="btn btn-sm btn-danger followup-delete-btn"
            data-id="${_esc(record.id)}"
            aria-label="Delete note for ${_esc(record.clientName)}"
          >Delete</button>
        </div>`,
    },
  ];

  // ── 7. Render the table ─────────────────────────────────────────────────
  const tableContainer = root.querySelector('#followups-table-container');

  new SortableTable(
    tableContainer,
    columns,
    rows,
    {
      defaultSort:  { key: 'date', direction: 'desc' },
      emptyMessage: 'No follow-up notes have been recorded yet.',
    }
  );

  // ── 8. "Add Note" button ────────────────────────────────────────────────
  root.querySelector('#followup-add-btn').addEventListener('click', () => {
    openFollowUpForm(null, clientIdFilter, () => renderFollowUpsView(root, clientIdFilter));
  });

  // ── 9. Edit / Delete event delegation ──────────────────────────────────
  tableContainer.addEventListener('click', async (e) => {
    const editBtn   = e.target.closest('.followup-edit-btn');
    const deleteBtn = e.target.closest('.followup-delete-btn');

    if (editBtn) {
      const noteId = editBtn.dataset.id;
      const note   = store.get('followUpNotes').find(n => n.id === noteId);
      if (note) {
        openFollowUpForm(note, clientIdFilter, () => renderFollowUpsView(root, clientIdFilter));
      }
      return;
    }

    if (deleteBtn) {
      const noteId    = deleteBtn.dataset.id;
      const confirmed = await ConfirmDialog.open(
        'Delete this follow-up note? This action cannot be undone.'
      );
      if (confirmed) {
        db.deleteFollowUpNote(noteId);
        Toast.show('Note deleted.', 'success');
        renderFollowUpsView(root, clientIdFilter);
      }
    }
  });

  // ── 10. Live search (global view only, debounced 300 ms) ────────────────
  if (isGlobalView) {
    const searchInput = root.querySelector('#followups-search');
    if (searchInput) {
      let _debounceTimer = null;

      searchInput.addEventListener('input', () => {
        clearTimeout(_debounceTimer);
        _debounceTimer = setTimeout(() => {
          const q = searchInput.value.trim().toLowerCase();

          if (!q) {
            // Restore full list
            new SortableTable(
              tableContainer,
              columns,
              rows,
              {
                defaultSort:  { key: 'date', direction: 'desc' },
                emptyMessage: 'No follow-up notes have been recorded yet.',
              }
            );
            return;
          }

          const filtered = rows.filter(r =>
            r.clientName.toLowerCase().includes(q) ||
            (r.noteText ?? '').toLowerCase().includes(q)
          );

          new SortableTable(
            tableContainer,
            columns,
            filtered,
            {
              defaultSort:  { key: 'date', direction: 'desc' },
              emptyMessage: 'No notes match your search.',
            }
          );
        }, 300);
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Follow-Up Note form modal
// ---------------------------------------------------------------------------

/**
 * Open a Modal containing the Add / Edit Follow-Up Note form.
 *
 * Rules:
 * - When `noteToEdit` is null  → "Add Note" mode (empty form)
 * - When `noteToEdit` is set   → "Edit Note" mode (pre-populated form)
 * - When `lockedClientId` is set → Client dropdown pre-populated and locked
 *   (profile Follow-Up tab context)
 *
 * @param {object|null}  noteToEdit      Existing note record, or null for new
 * @param {string|null}  lockedClientId  Pre-select + lock client; null = free choice
 * @param {Function}     onSaved         Callback invoked after a successful save
 */
export function openFollowUpForm(noteToEdit, lockedClientId, onSaved) {
  // Use all clients in the dropdown, not just active ones (Requirement 13.3)
  const clients = store.get('clients');

  const isEdit = noteToEdit !== null && noteToEdit !== undefined;
  const title  = isEdit ? 'Edit Follow-Up Note' : 'Add Follow-Up Note';

  // Determine which client id to pre-select
  const selectedClientId = isEdit
    ? noteToEdit.clientId
    : (lockedClientId ?? '');

  // Build <option> elements
  const clientOptions = clients
    .map(c => {
      const selected = c.id === selectedClientId ? 'selected' : '';
      return `<option value="${_esc(c.id)}" ${selected}>${_esc(c.fullName)}</option>`;
    })
    .join('');

  const disabledAttr   = lockedClientId ? 'disabled' : '';
  const defaultDate    = isEdit ? _esc(noteToEdit.date ?? today()) : today();
  const defaultNoteText = isEdit ? _esc(noteToEdit.noteText ?? '') : '';

  const bodyHTML = `
    <form id="followup-form" novalidate>
      <div class="form-group">
        <label for="followup-client" class="form-label">
          Client <span aria-hidden="true" class="required-mark">*</span>
        </label>
        <select
          id="followup-client"
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
        <label for="followup-date" class="form-label">
          Date <span aria-hidden="true" class="required-mark">*</span>
        </label>
        <input
          type="date"
          id="followup-date"
          name="date"
          class="form-control"
          value="${defaultDate}"
          required
          aria-required="true"
        />
      </div>

      <div class="form-group">
        <label for="followup-note-text" class="form-label">
          Note Text <span aria-hidden="true" class="required-mark">*</span>
        </label>
        <textarea
          id="followup-note-text"
          name="noteText"
          class="form-control"
          rows="5"
          maxlength="2000"
          placeholder="Enter follow-up notes (max 2000 characters)"
          required
          aria-required="true"
        >${defaultNoteText}</textarea>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary" id="followup-submit-btn">
          ${isEdit ? 'Save Changes' : 'Add Note'}
        </button>
        <button type="button" class="btn btn-secondary" id="followup-cancel-btn">Cancel</button>
      </div>
    </form>
  `;

  Modal.open(title, bodyHTML, { showFooter: false });

  // Wire up form after the modal's DOM is in place
  requestAnimationFrame(() => {
    const form = document.getElementById('followup-form');
    if (!form) return;

    // Cancel button
    const cancelBtn = form.querySelector('#followup-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => Modal.close());
    }

    // FormValidator setup
    const fv = new FormValidator(form);
    fv.register('clientId',  [validators.required]);
    fv.register('date',      [validators.required]);
    fv.register('noteText',  [
      validators.required,
      validators.notWhitespaceOnly,
      validators.maxLength(2000),
    ]);

    // Submit handler
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      // Read field values
      const clientIdField  = form.querySelector('[name="clientId"]');
      const dateField      = form.querySelector('[name="date"]');
      const noteTextField  = form.querySelector('[name="noteText"]');

      // Disabled selects are excluded from native form data — fall back to lockedClientId
      const clientId  = (clientIdField && clientIdField.value) || lockedClientId || '';
      const date      = dateField     ? dateField.value.trim()     : '';
      const noteText  = noteTextField ? noteTextField.value        : '';

      // Run validation
      fv.clearErrors();
      const { valid, errors } = fv.validate({ clientId, date, noteText });

      if (!valid) {
        fv.renderErrors(errors);
        return; // Keep modal open for corrections
      }

      // Persist
      try {
        db.saveFollowUpNote({
          clientId,
          date,
          noteText,
          ...(noteToEdit ? { id: noteToEdit.id } : {}),
        });
        Toast.show('Note saved.', 'success');
        Modal.close();
        onSaved();
      } catch (err) {
        console.error('[followUps] saveFollowUpNote error:', err);
        Toast.show('Failed to save note. Please try again.', 'error');
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

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
