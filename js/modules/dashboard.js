/**
 * dashboard.js — Dashboard module
 *
 * Exports pure stat-computation functions (no DOM, no side effects) used by
 * the dashboard render function (added in task 9.8).
 *
 * All statistics are computed fresh from `store.get()` on every render call
 * — there is no caching between renders.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8
 */

import { getISOWeekRange, daysAgo, today, isWithinNext7Days, formatDate } from '../utils.js';
import { store } from '../store.js';
import { SortableTable, StatusBadge } from '../components.js';

// ---------------------------------------------------------------------------
// Public pure functions
// ---------------------------------------------------------------------------

/**
 * Computes all dashboard summary statistics from the current store state.
 *
 * Called on every render — reads store fresh, no caching.
 *
 * @param {{ get: (key: string) => any }} store
 * @returns {{
 *   activeCount:        number,
 *   totalPoundsLost:    number,
 *   goalsCompleted:     number,
 *   goalsTotal:         number,
 *   avgHabitCompletion: number,
 *   avgMoodScore:       number|null,
 *   avgEnergyScore:     number|null,
 * }}
 */
export function computeStats(store) {
  const todayStr         = today();
  const clients          = store.get('clients');
  const goals            = store.get('goals');
  const habitAssignments = store.get('habitAssignments');
  const habitCompletions = store.get('habitCompletions');
  const checkIns         = store.get('checkIns');

  const activeCount        = computeActiveClientCount(clients);
  const totalPoundsLost    = computeTotalPoundsLost(clients);
  const { completed: goalsCompleted, total: goalsTotal } = computeGoalsStats(goals);
  const avgHabitCompletion = computeHabitCompletion(clients, habitAssignments, habitCompletions, todayStr);
  const { avgMood: avgMoodScore, avgEnergy: avgEnergyScore } = computeAvgCheckInScores(clients, checkIns, todayStr);

  return {
    activeCount,
    totalPoundsLost,
    goalsCompleted,
    goalsTotal,
    avgHabitCompletion,
    avgMoodScore,
    avgEnergyScore,
  };
}

/**
 * Returns the count of clients with status === 'Active'.
 *
 * Requirement 4.1 — "count of Clients whose Client Status is Active"
 *
 * @param {Array<{ status: string }>} clients
 * @returns {number}
 */
export function computeActiveClientCount(clients) {
  return clients.filter(c => c.status === 'Active').length;
}

/**
 * Returns the total pounds lost across all Active clients.
 *
 * - Per-client contribution = Math.max(0, startWeight − currentWeight)
 * - Sum rounded to 1 decimal place
 * - Clients where currentWeight >= startWeight contribute 0 (Requirement 4.2)
 * - Returns 0 when no active clients exist (Requirement 4.8)
 *
 * @param {Array<{ status: string, startWeight: number, currentWeight: number }>} clients
 * @returns {number}  ≥ 0, rounded to 1 dp
 */
export function computeTotalPoundsLost(clients) {
  const activeClients = clients.filter(c => c.status === 'Active');

  if (activeClients.length === 0) return 0;

  const total = activeClients.reduce((sum, c) => {
    const contribution = Math.max(0, c.startWeight - c.currentWeight);
    return sum + contribution;
  }, 0);

  return Math.round(total * 10) / 10;
}

/**
 * Returns the count of completed goals and the total goal count.
 *
 * Requirement 4.3 — "count of Goals with Goal Status = Complete, and total"
 *
 * @param {Array<{ status: string }>} goals
 * @returns {{ completed: number, total: number }}
 */
export function computeGoalsStats(goals) {
  return {
    completed: goals.filter(g => g.status === 'Complete').length,
    total:     goals.length,
  };
}

/**
 * Returns the average habit completion percentage for the current ISO week
 * across all Active clients, as an integer 0–100.
 *
 * Current ISO week = Monday 00:00 through Sunday 23:59 of the week containing
 * `todayStr`. A "slot" is one (habitAssignment × weekday) pair. Completion
 * is determined by matching HabitCompletion records with `completed === true`.
 *
 * Rules:
 * - Only Active clients are included
 * - Only HabitAssignments belonging to Active clients are counted
 * - Returns 0 when there are no active clients, or none have habits assigned
 *   (Requirement 4.4 / 4.8)
 * - Result rounded to nearest integer
 *
 * @param {Array<{ id: string, status: string }>}                            clients
 * @param {Array<{ id: string, clientId: string }>}                          habitAssignments
 * @param {Array<{ habitAssignmentId: string, date: string, completed: boolean }>} habitCompletions
 * @param {string} todayStr  ISO date string "YYYY-MM-DD"
 * @returns {number}  integer 0–100
 */
export function computeHabitCompletion(clients, habitAssignments, habitCompletions, todayStr) {
  const activeIds = new Set(
    clients.filter(c => c.status === 'Active').map(c => c.id)
  );

  if (activeIds.size === 0) return 0;

  // HabitAssignments for active clients only
  const activeAssignments = habitAssignments.filter(ha => activeIds.has(ha.clientId));

  if (activeAssignments.length === 0) return 0;

  const { monday, sunday } = getISOWeekRange(todayStr);

  // Total slots = number of active habit assignments × 7 days
  const totalSlots = activeAssignments.length * 7;

  // Build a lookup set of assignment ids for quick membership check
  const activeAssignmentIds = new Set(activeAssignments.map(ha => ha.id));

  // Count completions where completed === true, assignment is active, date is in current week
  const checkedCount = habitCompletions.filter(
    hc =>
      hc.completed === true &&
      activeAssignmentIds.has(hc.habitAssignmentId) &&
      hc.date >= monday &&
      hc.date <= sunday
  ).length;

  return Math.round((checkedCount / totalSlots) * 100);
}

/**
 * Returns the average mood and energy scores across all Active clients'
 * check-ins in the last 7 calendar days (inclusive range [today−6, today]).
 *
 * Rules:
 * - Only check-ins belonging to Active clients are included
 * - "Last 7 days" = [daysAgo(6), todayStr] inclusive (7 calendar days total)
 * - Returns null for each score when no qualifying check-ins exist
 *   (Requirements 4.7, 4.8)
 * - Scores rounded to 1 decimal place
 *
 * @param {Array<{ id: string, status: string }>}                                  clients
 * @param {Array<{ clientId: string, date: string, moodScore: number, energyScore: number }>} checkIns
 * @param {string} todayStr  ISO date string "YYYY-MM-DD"
 * @returns {{ avgMood: number|null, avgEnergy: number|null }}
 */
export function computeAvgCheckInScores(clients, checkIns, todayStr) {
  const activeIds = new Set(
    clients.filter(c => c.status === 'Active').map(c => c.id)
  );

  // 7 days inclusive: today−6 through today
  const startDate = daysAgo(6);

  const qualifying = checkIns.filter(
    ci =>
      activeIds.has(ci.clientId) &&
      ci.date >= startDate &&
      ci.date <= todayStr
  );

  if (qualifying.length === 0) {
    return { avgMood: null, avgEnergy: null };
  }

  const moodSum   = qualifying.reduce((sum, ci) => sum + ci.moodScore, 0);
  const energySum = qualifying.reduce((sum, ci) => sum + ci.energyScore, 0);
  const count     = qualifying.length;

  return {
    avgMood:   Math.round((moodSum   / count) * 10) / 10,
    avgEnergy: Math.round((energySum / count) * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// Dashboard — Upcoming Appointments and Recent Follow-Ups
// Requirements: 6.1, 6.2, 6.3
// ---------------------------------------------------------------------------

/**
 * Returns all clients whose `nextAppointment` falls within the inclusive
 * 7-day window [todayStr, todayStr + 6], sorted ascending by date.
 *
 * Requirement 6.1 — "all Clients whose Next Appointment date falls within the
 * next 7 calendar days starting from and including today … sorted by Next
 * Appointment date ascending"
 *
 * @param {Array<{ nextAppointment: string }>} clients
 * @param {string} todayStr  ISO date string "YYYY-MM-DD"
 * @returns {Array<{ nextAppointment: string }>}  may be empty
 */
export function getUpcomingAppointments(clients, todayStr) {
  return clients
    .filter(c => isWithinNext7Days(c.nextAppointment, todayStr))
    .sort((a, b) => {
      if (a.nextAppointment < b.nextAppointment) return -1;
      if (a.nextAppointment > b.nextAppointment) return  1;
      return 0;
    });
}

/**
 * Returns the 5 most recently created follow-up notes, sorted descending by
 * `createdAt`, each mapped to `{ clientName, date, preview }`.
 *
 * - `clientName` is resolved from the provided `clients` array via `clientId`
 * - `date` is the note's `date` field (ISO date string "YYYY-MM-DD")
 * - `preview` is produced by `previewText(noteText, 80)`
 *
 * Requirement 6.2 — "at most the 5 most recently created Follow-Up Notes …
 * Client Name, note date, and a preview of the first 80 characters of note
 * text followed by '…' if the note exceeds 80 characters"
 *
 * @param {Array<{ clientId: string, date: string, noteText: string, createdAt: string }>} notes
 * @param {Array<{ id: string, fullName: string }>} clients
 * @returns {Array<{ clientName: string, date: string, preview: string }>}
 */
export function getRecentFollowUps(notes, clients) {
  // Build a clientId → fullName lookup map
  const nameMap = new Map(clients.map(c => [c.id, c.fullName]));

  return notes
    .slice()                                              // avoid mutating original
    .sort((a, b) => {
      if (a.createdAt > b.createdAt) return -1;
      if (a.createdAt < b.createdAt) return  1;
      return 0;
    })
    .slice(0, 5)
    .map(note => ({
      clientName: nameMap.get(note.clientId) ?? 'Unknown',
      date:       note.date,
      preview:    previewText(note.noteText, 80),
    }));
}

/**
 * Returns a preview of `text` truncated to `limit` characters.
 *
 * - If `text.length <= limit`, returns `text` unchanged.
 * - If `text.length > limit`, returns `text.slice(0, limit) + '…'`.
 * - The result is never longer than `limit + 1` characters (the extra
 *   character being the single ellipsis '…', which is one Unicode code point).
 *
 * Requirement 6.2 — preview of the first 80 characters followed by "…"
 *
 * @param {string} text
 * @param {number} limit  maximum number of characters before truncation
 * @returns {string}
 */
export function previewText(text, limit) {
  if (text.length <= limit) return text;
  return text.slice(0, limit) + '\u2026'; // '…' (U+2026 HORIZONTAL ELLIPSIS)
}

// ---------------------------------------------------------------------------
// Dashboard render
// Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
// ---------------------------------------------------------------------------

/**
 * Render the full dashboard into `root`.
 *
 * Reads all store collections fresh on every call (no caching between renders).
 * Builds:
 *  1. Stats strip — 6 metric cards
 *  2. Status filter + client roster SortableTable
 *  3. Upcoming appointments section
 *  4. Recent follow-ups section
 *
 * @param {HTMLElement} root    - The `<main id="app-root">` element.
 * @param {object}      _params - Route params (unused on the dashboard).
 */
export function render(root, _params) {
  // ── 1. Read fresh data ───────────────────────────────────────────────────
  const clients          = store.get('clients');
  const goals            = store.get('goals');         // eslint-disable-line no-unused-vars
  const habitAssignments = store.get('habitAssignments'); // eslint-disable-line no-unused-vars
  const habitCompletions = store.get('habitCompletions'); // eslint-disable-line no-unused-vars
  const checkIns         = store.get('checkIns');
  const followUpNotes    = store.get('followUpNotes');
  const settings         = store.get('settings');

  // ── 2. Compute stats ────────────────────────────────────────────────────
  const stats = computeStats(store);

  // ── 3. Build status-filter options ─────────────────────────────────────
  const statusValues = settings.clientStatusValues || ['Active', 'Inactive', 'Graduated'];
  const statusOptions = statusValues
    .map(v => `<option value="${_esc(v)}">${_esc(v)}</option>`)
    .join('');

  // ── 4. Build upcoming appointments HTML ─────────────────────────────────
  const upcomingClients = getUpcomingAppointments(clients, today());
  const upcomingHTML = upcomingClients.length > 0
    ? upcomingClients.map(c => `
        <div class="appointment-item">
          <span class="appointment-name">${_esc(c.fullName)}</span>
          <span class="appointment-date">${_esc(formatDate(c.nextAppointment))}</span>
        </div>`).join('')
    : '<p class="empty-message">No upcoming appointments.</p>';

  // ── 5. Build recent follow-ups HTML ─────────────────────────────────────
  const recentFollowUps = getRecentFollowUps(followUpNotes, clients);
  const followUpsHTML = recentFollowUps.length > 0
    ? recentFollowUps.map(f => `
        <div class="followup-item">
          <div class="followup-meta">
            <span class="followup-client">${_esc(f.clientName)}</span>
            <span class="followup-date">${_esc(formatDate(f.date))}</span>
          </div>
          <p class="followup-preview">${_esc(f.preview)}</p>
        </div>`).join('')
    : '<p class="empty-message">No recent follow-ups.</p>';

  // ── 6. Set root HTML ────────────────────────────────────────────────────
  root.innerHTML = `
    <section class="dashboard" aria-label="Dashboard">

      <!-- Stats Strip -->
      <div class="stats-strip" aria-label="Summary statistics">
        <div class="stat-card">
          <span class="stat-label">Active Clients</span>
          <span class="stat-value">${stats.activeCount}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Total lbs Lost</span>
          <span class="stat-value">${stats.totalPoundsLost.toFixed(1)}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Goals Completed</span>
          <span class="stat-value">${stats.goalsCompleted} of ${stats.goalsTotal}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Avg Habit Completion</span>
          <span class="stat-value">${stats.avgHabitCompletion}%</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Avg Mood Score</span>
          <span class="stat-value">${stats.avgMoodScore !== null ? stats.avgMoodScore.toFixed(1) : '—'}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Avg Energy Score</span>
          <span class="stat-value">${stats.avgEnergyScore !== null ? stats.avgEnergyScore.toFixed(1) : '—'}</span>
        </div>
      </div>

      <!-- Client Roster -->
      <div class="dashboard-section roster-section">
        <div class="roster-header">
          <h2 class="section-title">Client Roster</h2>
          <div class="roster-filters">
            <label for="dashboard-status-filter" class="filter-label">Status</label>
            <select id="dashboard-status-filter" class="filter-select" aria-label="Filter by client status">
              <option value="All">All</option>
              ${statusOptions}
            </select>
          </div>
        </div>
        <div id="dashboard-roster-table" class="roster-table-container"></div>
      </div>

      <!-- Upcoming Appointments -->
      <div class="dashboard-section">
        <h2 class="section-title">Upcoming Appointments</h2>
        <div class="upcoming-appointments" id="dashboard-upcoming">
          ${upcomingHTML}
        </div>
      </div>

      <!-- Recent Follow-Ups -->
      <div class="dashboard-section">
        <h2 class="section-title">Recent Follow-Ups</h2>
        <div class="recent-followups" id="dashboard-followups">
          ${followUpsHTML}
        </div>
      </div>

    </section>
  `;

  // ── 7. Build column definitions ─────────────────────────────────────────
  const columns = [
    { key: 'fullName',       label: 'Name' },
    { key: 'clientId',       label: 'Client ID' },
    { key: 'startWeight',    label: 'Start Weight' },
    { key: 'currentWeight',  label: 'Current Weight' },
    {
      key: '_poundsLost',
      label: 'Pounds Lost',
      // sortable: false — computed field, not a true data key
      sortable: false,
      render: (_v, record) =>
        String(Math.max(0, (record.startWeight || 0) - (record.currentWeight || 0))),
    },
    {
      key: '_latestMood',
      label: 'Latest Mood',
      sortable: false,
      render: (_v, record) => {
        const ci = _latestCheckIn(record.id, checkIns);
        return ci ? String(ci.moodScore) : '—';
      },
    },
    {
      key: '_latestEnergy',
      label: 'Latest Energy',
      sortable: false,
      render: (_v, record) => {
        const ci = _latestCheckIn(record.id, checkIns);
        return ci ? String(ci.energyScore) : '—';
      },
    },
    {
      key: 'nextAppointment',
      label: 'Next Appointment',
      render: (v) => v ? _esc(formatDate(v)) : '—',
    },
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
  ];

  // ── 8. Instantiate SortableTable ─────────────────────────────────────────
  const tableContainer = root.querySelector('#dashboard-roster-table');

  /** @param {string} selectedStatus */
  function buildTable(selectedStatus) {
    const filtered = selectedStatus === 'All'
      ? clients
      : clients.filter(c => c.status === selectedStatus);

    if (tableInstance) {
      tableInstance.update(filtered);
    } else {
      tableInstance = new SortableTable(
        tableContainer,
        columns,
        filtered,
        {
          defaultSort: { key: 'fullName', direction: 'asc' },
          onRowClick: (record) => { location.hash = '#/clients/' + record.id; },
          emptyMessage: 'No clients have been added yet.',
        }
      );
    }
  }

  let tableInstance = null;
  buildTable('All');

  // ── 9. Wire status filter ────────────────────────────────────────────────
  const filterSelect = root.querySelector('#dashboard-status-filter');
  filterSelect.addEventListener('change', () => {
    buildTable(filterSelect.value);
  });
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Returns the most recent check-in for a given client, or null if none exist.
 *
 * "Most recent" = the check-in with the latest `date` string (ISO lexicographic
 * order). When multiple check-ins share the same date, the one with the latest
 * `createdAt` is used as a tiebreaker.
 *
 * @param {string} clientId
 * @param {Array<{ clientId: string, date: string, createdAt: string }>} checkIns
 * @returns {{ moodScore: number, energyScore: number } | null}
 */
function _latestCheckIn(clientId, checkIns) {
  const clientCheckIns = checkIns.filter(ci => ci.clientId === clientId);
  if (clientCheckIns.length === 0) return null;

  return clientCheckIns.reduce((best, ci) => {
    if (ci.date > best.date) return ci;
    if (ci.date === best.date && ci.createdAt > best.createdAt) return ci;
    return best;
  });
}

/**
 * Minimal HTML-escape for values inserted into innerHTML.
 *
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
