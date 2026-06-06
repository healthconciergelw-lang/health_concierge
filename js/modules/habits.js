/**
 * habits.js — Habit Tracker module
 *
 * Exports:
 *   render(root, params)                              — top-level router entry point
 *   renderHabitsView(root, clientIdFilter)            — reusable view (also called from Client Profile Habits tab)
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.8
 */

import { store } from '../store.js';
import { db } from '../db.js';
import { today, getISOWeekRange } from '../utils.js';

// ---------------------------------------------------------------------------
// Module-level state — persists between renders in the same session
// ---------------------------------------------------------------------------

/** The anchor date used to compute the currently-displayed ISO week. */
let currentWeekDate = today();

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Adds `n` days to an ISO date string and returns the resulting ISO date
 * string, computed in local time (avoids UTC timezone shift issues).
 *
 * @param {string} isoStr  ISO date string "YYYY-MM-DD"
 * @param {number} n       Days to add (positive or negative)
 * @returns {string}       ISO date string "YYYY-MM-DD"
 */
function addDays(isoStr, n) {
  const [y, m, d] = isoStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  const yr = dt.getFullYear();
  const mo = String(dt.getMonth() + 1).padStart(2, '0');
  const dy = String(dt.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${dy}`;
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Router entry point for the /habits route.
 * Shows habits for all clients (no client filter).
 *
 * @param {HTMLElement} root
 * @param {object}      _params  Route params (unused)
 */
export function render(root, _params) {
  renderHabitsView(root, null);
}

/**
 * Render the weekly habits grid into `root`.
 *
 * When `clientIdFilter` is a non-null client id string, only that client's
 * habits and completions are shown (Client Profile Habits tab — Requirement 11.7).
 * When `clientIdFilter` is null, all clients are shown (Requirements 11.1–11.5, 11.8).
 *
 * @param {HTMLElement}  root
 * @param {string|null}  clientIdFilter  Client UUID or null for global view
 */
export function renderHabitsView(root, clientIdFilter) {
  // ── 1. Compute week date range ─────────────────────────────────────────
  const { monday, sunday } = getISOWeekRange(currentWeekDate);

  // Build an array of the 7 ISO date strings for Mon → Sun
  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    weekDates.push(addDays(monday, i));
  }

  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // ── 2. Read fresh data from store ──────────────────────────────────────
  const clients          = store.get('clients');
  const habitAssignments = store.get('habitAssignments');
  const habitCompletions = store.get('habitCompletions');

  // ── 3. Apply optional client filter ────────────────────────────────────
  const visibleClients = clientIdFilter
    ? clients.filter(c => c.id === clientIdFilter)
    : clients;

  // ── 4. Build a completion lookup: "assignmentId|date" → true ───────────
  /** @type {Set<string>} */
  const completionSet = new Set(
    habitCompletions.map(hc => `${hc.habitAssignmentId}|${hc.date}`)
  );

  // ── 5. Build table rows HTML ────────────────────────────────────────────
  let tableRowsHTML = '';

  for (const client of visibleClients) {
    const clientAssignments = habitAssignments.filter(
      a => a.clientId === client.id
    );

    if (clientAssignments.length === 0) {
      // Requirement 11.8 — no habits assigned message, including client name
      tableRowsHTML += `
        <tr>
          <td>${_esc(client.fullName)}</td>
          <td colspan="9" class="no-habits-message">
            No habits assigned for ${_esc(client.fullName)}. Configure habits in Settings.
          </td>
        </tr>
      `;
      continue;
    }

    // Compute completion % for this client across the current week
    let totalSlots   = clientAssignments.length * 7;
    let checkedSlots = 0;

    for (const ha of clientAssignments) {
      for (const date of weekDates) {
        if (completionSet.has(`${ha.id}|${date}`)) {
          checkedSlots++;
        }
      }
    }

    const pct = totalSlots > 0 ? Math.round((checkedSlots / totalSlots) * 100) : 0;

    for (const ha of clientAssignments) {
      const habitName = ha.habitName ?? '';
      let checkboxCellsHTML = '';

      for (const date of weekDates) {
        const checked = completionSet.has(`${ha.id}|${date}`);
        checkboxCellsHTML += `
          <td class="habit-checkbox-cell">
            <input
              type="checkbox"
              class="habit-checkbox"
              data-assignment-id="${_esc(ha.id)}"
              data-date="${_esc(date)}"
              aria-label="${_esc(habitName)} on ${_esc(date)}"
              ${checked ? 'checked' : ''}
            >
          </td>
        `;
      }

      tableRowsHTML += `
        <tr>
          <td>${_esc(client.fullName)}</td>
          <td>${_esc(habitName)}</td>
          ${checkboxCellsHTML}
          <td class="completion-pct">${pct}%</td>
        </tr>
      `;
    }
  }

  // Edge-case: no clients visible at all
  if (visibleClients.length === 0) {
    tableRowsHTML = `
      <tr>
        <td colspan="10" class="empty-state-cell">No clients found.</td>
      </tr>
    `;
  }

  // ── 6. Render full HTML ─────────────────────────────────────────────────
  root.innerHTML = `
    <section class="habits-view" aria-label="Habit Tracker">
      <div class="habits-header">
        <h2 class="section-title">Habits</h2>
      </div>

      <div class="habits-week-nav" role="group" aria-label="Week navigation">
        <button type="button" class="btn btn-secondary" id="habits-prev-btn">← Prev</button>
        <input
          type="date"
          id="habits-week-picker"
          class="form-control habits-date-picker"
          value="${_esc(currentWeekDate)}"
          aria-label="Select week"
        >
        <button type="button" class="btn btn-secondary" id="habits-next-btn">Next →</button>
        <span class="habits-week-label" aria-live="polite">Week of ${_esc(monday)} – ${_esc(sunday)}</span>
      </div>

      <div class="table-wrapper">
        <table class="table habits-table">
          <thead>
            <tr>
              <th scope="col">Client</th>
              <th scope="col">Habit</th>
              ${DAY_LABELS.map(d => `<th scope="col">${_esc(d)}</th>`).join('')}
              <th scope="col">%</th>
            </tr>
          </thead>
          <tbody id="habits-tbody">
            ${tableRowsHTML}
          </tbody>
        </table>
      </div>
    </section>
  `;

  // ── 7. Wire event listeners ─────────────────────────────────────────────

  // Previous week button (Requirement 11.2)
  root.querySelector('#habits-prev-btn').addEventListener('click', () => {
    currentWeekDate = addDays(currentWeekDate, -7);
    renderHabitsView(root, clientIdFilter);
  });

  // Next week button (Requirement 11.2)
  root.querySelector('#habits-next-btn').addEventListener('click', () => {
    currentWeekDate = addDays(currentWeekDate, 7);
    renderHabitsView(root, clientIdFilter);
  });

  // Date picker change (Requirement 11.1)
  const input = root.querySelector('#habits-week-picker');
  input.addEventListener('change', () => {
    currentWeekDate = input.value;
    renderHabitsView(root, clientIdFilter);
  });

  // Per-checkbox change handlers (Requirement 11.4)
  root.querySelectorAll('.habit-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      db.setHabitCompletion(cb.dataset.assignmentId, cb.dataset.date, cb.checked);
    });
  });
}
