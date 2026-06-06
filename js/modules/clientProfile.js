/**
 * clientProfile.js — Client Profile module
 *
 * Exports `render(root, params)` where `params.id` is the client UUID.
 *
 * Implements:
 *   - Persistent header: client name, clientId, Priority badge, Status badge
 *   - Scope disclaimer banner (Requirement 1.3)
 *   - Tab strip: Intake, Goals, Habits, Mood & Energy, Follow-Up Notes
 *   - Default tab: Intake (Requirement 9.3)
 *   - Selected tab persisted in sessionStorage keyed by client.id (Requirement 9.4)
 *   - Arrow-key navigation between tabs (Requirement 18.1)
 *   - Tab content rendered within 300ms (Requirement 9.4)
 *
 * Tab content stubs (filled by later tasks):
 *   11.2 → clientIntake.js    → renderIntakeTab
 *   12.3 → clientGoals.js     → renderGoalsTab
 *   13.2 → clientHabits.js    → renderHabitsTab
 *   14.3 → clientMoodEnergy.js → renderMoodEnergyTab
 *   15.3 → clientFollowUps.js → renderFollowUpNotesTab
 *
 * Requirements: 1.3, 9.1, 9.2, 9.3, 9.4, 18.1
 */

import { db }          from '../db.js';
import { store }       from '../store.js';
import { StatusBadge, FormValidator, Toast } from '../components.js';
import { renderGoalsView } from './goals.js';
import { renderHabitsView } from './habits.js';
import { renderMoodEnergyView } from './moodEnergy.js';
import { renderFollowUpsView } from './followUps.js';
import { formatDate }  from '../utils.js';
import { validators }  from '../validation.js';

// ---------------------------------------------------------------------------
// Tab stubs — replaced by later tasks (11.2, 12.3, 13.2, 14.3, 15.3)
// Each stub renders a placeholder section into `panelEl`.
// ---------------------------------------------------------------------------

/**
 * Stub: Intake tab content (task 11.2 will replace with clientIntake.js)
 * @param {HTMLElement} panelEl
 * @param {object} client
 */
function _stubIntake(panelEl, client) {
  _renderIntakeReadOnly(panelEl, client);
}

function _renderIntakeReadOnly(panelEl, client) {
  panelEl.innerHTML = `
    <div class="intake-view">
      <div class="intake-header">
        <h3 class="h3">Intake Information</h3>
        <button type="button" class="btn btn-secondary" id="intake-edit-btn">Edit</button>
      </div>
      <dl class="intake-fields">
        <div class="intake-field"><dt>Full Name</dt><dd>${_esc(client.fullName)}</dd></div>
        <div class="intake-field"><dt>Client ID</dt><dd>${_esc(client.clientId)}</dd></div>
        <div class="intake-field"><dt>Start Weight</dt><dd>${_esc(String(client.startWeight ?? ''))} lbs</dd></div>
        <div class="intake-field"><dt>Current Weight</dt><dd>${_esc(String(client.currentWeight ?? ''))} lbs</dd></div>
        <div class="intake-field"><dt>Next Appointment</dt><dd>${_esc(formatDate(client.nextAppointment) || '—')}</dd></div>
        <div class="intake-field"><dt>Priority Level</dt><dd>${_esc(client.priorityLevel ?? '—')}</dd></div>
        <div class="intake-field"><dt>Client Status</dt><dd>${_esc(client.status ?? '—')}</dd></div>
        <div class="intake-field"><dt>Support Style</dt><dd>${_esc(client.supportStyle ?? '—')}</dd></div>
      </dl>
    </div>
  `;
  panelEl.querySelector('#intake-edit-btn').addEventListener('click', () => {
    _renderIntakeEditForm(panelEl, client);
  });
}

function _renderIntakeEditForm(panelEl, client) {
  const settings = store.get('settings');
  const mkOpts = (list, current) => (list || []).map(v =>
    `<option value="${_esc(v)}"${current === v ? ' selected' : ''}>${_esc(v)}</option>`).join('');
  const priorityOptions = mkOpts(settings.priorityLevels || ['High','Medium','Low'], client.priorityLevel);
  const statusOptions   = mkOpts(settings.clientStatusValues || ['Active','Inactive','Graduated'], client.status);
  const styleOptions    = mkOpts(settings.supportStyles || ['Weekly Check-In'], client.supportStyle);

  panelEl.innerHTML = `
    <form id="intake-edit-form" novalidate class="intake-form">
      <div class="form-group">
        <label for="ie-fullName" class="form-label">Full Name <span aria-hidden="true" class="required-mark">*</span></label>
        <input type="text" id="ie-fullName" name="fullName" class="form-input" value="${_esc(client.fullName)}" required aria-required="true" maxlength="100">
      </div>
      <div class="form-group">
        <label class="form-label">Client ID</label>
        <input type="text" class="form-input" value="${_esc(client.clientId)}" disabled aria-disabled="true">
      </div>
      <div class="form-group">
        <label for="ie-startWeight" class="form-label">Start Weight (lbs) <span aria-hidden="true" class="required-mark">*</span></label>
        <input type="number" id="ie-startWeight" name="startWeight" class="form-input" value="${_esc(String(client.startWeight ?? ''))}" required aria-required="true" step="0.1" min="1" max="2000">
      </div>
      <div class="form-group">
        <label for="ie-currentWeight" class="form-label">Current Weight (lbs) <span aria-hidden="true" class="required-mark">*</span></label>
        <input type="number" id="ie-currentWeight" name="currentWeight" class="form-input" value="${_esc(String(client.currentWeight ?? ''))}" required aria-required="true" step="0.1" min="1" max="2000">
      </div>
      <div class="form-group">
        <label for="ie-nextAppointment" class="form-label">Next Appointment</label>
        <input type="date" id="ie-nextAppointment" name="nextAppointment" class="form-input" value="${_esc(client.nextAppointment ?? '')}">
      </div>
      <div class="form-group">
        <label for="ie-priorityLevel" class="form-label">Priority Level</label>
        <select id="ie-priorityLevel" name="priorityLevel" class="form-select">${priorityOptions}</select>
      </div>
      <div class="form-group">
        <label for="ie-status" class="form-label">Client Status</label>
        <select id="ie-status" name="status" class="form-select">${statusOptions}</select>
      </div>
      <div class="form-group">
        <label for="ie-supportStyle" class="form-label">Support Style</label>
        <select id="ie-supportStyle" name="supportStyle" class="form-select">${styleOptions}</select>
      </div>
      <div class="form-actions" style="display:flex;gap:0.75rem;margin-top:1rem;">
        <button type="submit" class="btn btn-primary">Save</button>
        <button type="button" class="btn btn-secondary" id="intake-cancel-btn">Cancel</button>
      </div>
    </form>
  `;
  panelEl.querySelector('#intake-cancel-btn').addEventListener('click', () => {
    _renderIntakeReadOnly(panelEl, client);
  });
  const form = panelEl.querySelector('#intake-edit-form');
  const fv = new FormValidator(form);
  fv.register('fullName',      [validators.required, validators.maxLength(100)]);
  fv.register('startWeight',   [validators.required, validators.numeric, validators.range(1, 2000)]);
  fv.register('currentWeight', [validators.required, validators.numeric, validators.range(1, 2000)]);
  fv.register('nextAppointment', [validators.notPastDate]);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const data = {
      fullName:       (fd.get('fullName') || '').trim(),
      startWeight:    parseFloat(fd.get('startWeight') || ''),
      currentWeight:  parseFloat(fd.get('currentWeight') || ''),
      nextAppointment: fd.get('nextAppointment') || null,
      priorityLevel:  fd.get('priorityLevel') || client.priorityLevel,
      status:         fd.get('status') || client.status,
      supportStyle:   fd.get('supportStyle') || client.supportStyle,
    };
    fv.clearErrors();
    const { valid, errors } = fv.validate(data);
    if (!valid) { fv.renderErrors(errors); return; }
    try {
      const saved = db.saveClient({ ...client, ...data });
      Toast.show('Client updated.', 'success');
      _renderIntakeReadOnly(panelEl, saved);
    } catch (err) {
      Toast.show('Failed to save: ' + (err.message || 'Unknown error'), 'error');
    }
  });
}

/**
 * Goals tab content — delegates to renderGoalsView (task 12.3)
 * @param {HTMLElement} panelEl
 * @param {object} client
 */
function _stubGoals(panelEl, client) {
  renderGoalsView(panelEl, client.id);
}

/**
 * Habits tab content — delegates to renderHabitsView (task 13.2)
 * @param {HTMLElement} panelEl
 * @param {object} client
 */
function _stubHabits(panelEl, client) {
  renderHabitsView(panelEl, client.id);
}

/**
 * Mood & Energy tab content — delegates to renderMoodEnergyView (task 14.3)
 * @param {HTMLElement} panelEl
 * @param {object} client
 */
function _stubMoodEnergy(panelEl, client) {
  renderMoodEnergyView(panelEl, client.id);
}

/**
 * Follow-Up Notes tab content — delegates to renderFollowUpsView (task 15.3)
 * @param {HTMLElement} panelEl
 * @param {object} client
 */
function _stubFollowUpNotes(panelEl, client) {
  renderFollowUpsView(panelEl, client.id);
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

/**
 * @typedef {{ id: string, label: string, render: (panelEl: HTMLElement, client: object) => void }} TabDef
 */

/** @type {TabDef[]} */
const TABS = [
  { id: 'intake',        label: 'Intake',           render: _stubIntake        },
  { id: 'goals',         label: 'Goals',            render: _stubGoals         },
  { id: 'habits',        label: 'Habits',           render: _stubHabits        },
  { id: 'mood-energy',   label: 'Mood & Energy',    render: _stubMoodEnergy    },
  { id: 'follow-up-notes', label: 'Follow-Up Notes', render: _stubFollowUpNotes },
];

// ---------------------------------------------------------------------------
// Session-storage helpers
// ---------------------------------------------------------------------------

/**
 * Reads the persisted tab id for a given client from sessionStorage.
 *
 * @param {string} clientId  - The client's UUID (client.id)
 * @returns {string|null}    - Saved tab id or null if not set
 */
function _getSavedTab(clientId) {
  try {
    return sessionStorage.getItem(`profile-tab-${clientId}`);
  } catch {
    return null;
  }
}

/**
 * Persists the selected tab id for a given client in sessionStorage.
 *
 * @param {string} clientId  - The client's UUID (client.id)
 * @param {string} tabId     - The tab id to save
 */
function _saveTab(clientId, tabId) {
  try {
    sessionStorage.setItem(`profile-tab-${clientId}`, tabId);
  } catch {
    // sessionStorage write failure is non-fatal — silently ignore
  }
}

// ---------------------------------------------------------------------------
// HTML escape helper
// ---------------------------------------------------------------------------

/**
 * Minimal HTML-escape to prevent XSS when inserting user data via innerHTML.
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

// ---------------------------------------------------------------------------
// render — public entry point
// ---------------------------------------------------------------------------

/**
 * Render the Client Profile screen into `root`.
 *
 * Structure:
 *   .profile-header         — name, clientId, priority badge, status badge
 *   .disclaimer-inline      — non-medical scope disclaimer (Requirement 1.3)
 *   [role="tablist"]        — 5 tab buttons
 *   [role="tabpanel"] × 5   — tab content panels (only active one rendered)
 *
 * @param {HTMLElement} root   - The `<main id="app-root">` element.
 * @param {{ id: string }} params - Route params; `id` is the client UUID.
 */
export function render(root, params) {
  // ── 1. Look up client ────────────────────────────────────────────────────
  const client = db.getClientById(params && params.id);

  if (!client) {
    root.innerHTML = `
      <div class="profile-error" role="alert">
        <p>Client not found. The record may have been deleted or the link is invalid.</p>
        <a href="#/clients" class="btn btn-secondary">Back to Clients</a>
      </div>
    `;
    return;
  }

  // ── 2. Determine initial tab ─────────────────────────────────────────────
  // Requirement 9.3: default to Intake; 9.4: restore from sessionStorage
  const savedTabId = _getSavedTab(client.id);
  const validTabIds = TABS.map(t => t.id);
  const initialTabId = (savedTabId && validTabIds.includes(savedTabId))
    ? savedTabId
    : 'intake';

  // ── 3. Build tab strip HTML ──────────────────────────────────────────────
  const tabButtonsHTML = TABS.map(tab => {
    const isSelected = tab.id === initialTabId;
    return `
      <button
        role="tab"
        id="tab-btn-${_esc(tab.id)}"
        aria-selected="${isSelected ? 'true' : 'false'}"
        aria-controls="tab-panel-${_esc(tab.id)}"
        class="profile-tab${isSelected ? ' is-active' : ''}"
        tabindex="${isSelected ? '0' : '-1'}"
        data-tab-id="${_esc(tab.id)}"
      >${_esc(tab.label)}</button>
    `;
  }).join('');

  // ── 4. Build tab panels HTML ─────────────────────────────────────────────
  const tabPanelsHTML = TABS.map(tab => {
    const isActive = tab.id === initialTabId;
    return `
      <div
        role="tabpanel"
        id="tab-panel-${_esc(tab.id)}"
        aria-labelledby="tab-btn-${_esc(tab.id)}"
        class="tab-panel${isActive ? ' is-active' : ''}"
        ${isActive ? '' : 'hidden'}
      ></div>
    `;
  }).join('');

  // ── 5. Set root HTML ─────────────────────────────────────────────────────
  root.innerHTML = `
    <div class="client-profile" data-client-id="${_esc(client.id)}">

      <!-- Persistent header (Requirement 9.1) -->
      <div class="profile-header">
        <div class="profile-header__identity">
          <h1 class="profile-header__name">${_esc(client.fullName)}</h1>
          <span class="profile-header__client-id">ID: ${_esc(client.clientId)}</span>
        </div>
        <div class="profile-header__badges" aria-label="Client status badges">
          ${StatusBadge.render(client.priorityLevel, 'Priority')}
          ${StatusBadge.render(client.status, 'Client Status')}
        </div>
      </div>

      <!-- Scope disclaimer (Requirements 1.2, 1.3) -->
      <div class="disclaimer-inline" role="note" aria-label="Non-medical scope disclaimer">
        <strong>Non-Medical Tool:</strong>
        This application does not provide diagnosis or treatment or prescribing of any kind.
        All medical decisions remain between the client and their licensed healthcare provider.
        This tool is not a replacement for licensed healthcare providers.
      </div>

      <!-- Tab strip (Requirement 9.2) -->
      <div
        class="profile-tabs"
        role="tablist"
        aria-label="Client profile sections"
      >
        ${tabButtonsHTML}
      </div>

      <!-- Tab panels -->
      <div class="profile-tab-panels">
        ${tabPanelsHTML}
      </div>

    </div>
  `;

  // ── 6. Render initial tab content ────────────────────────────────────────
  _renderTabContent(root, client, initialTabId);

  // ── 7. Wire tab click handlers ───────────────────────────────────────────
  const tablist = root.querySelector('[role="tablist"]');
  tablist.addEventListener('click', (e) => {
    const btn = e.target.closest('[role="tab"]');
    if (!btn) return;
    const tabId = btn.dataset.tabId;
    if (tabId) {
      _activateTab(root, client, tabId);
    }
  });

  // ── 8. Wire arrow-key navigation (Requirement 18.1) ─────────────────────
  tablist.addEventListener('keydown', (e) => {
    const btn = e.target.closest('[role="tab"]');
    if (!btn) return;

    const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
    const currentIndex = tabs.indexOf(btn);

    let nextIndex = -1;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIndex = tabs.length - 1;
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const tabId = btn.dataset.tabId;
      if (tabId) _activateTab(root, client, tabId);
      return;
    }

    if (nextIndex >= 0) {
      const nextTab = tabs[nextIndex];
      nextTab.focus();
      // Activate on focus so arrow navigation also switches content
      // (roving tabindex pattern)
      const tabId = nextTab.dataset.tabId;
      if (tabId) _activateTab(root, client, tabId);
    }
  });
}

// ---------------------------------------------------------------------------
// _activateTab — switch active tab + render content
// ---------------------------------------------------------------------------

/**
 * Deactivates the currently active tab and activates the target tab.
 * Persists the selection in sessionStorage.
 * Renders tab content if the panel is empty (lazy init).
 *
 * Tab content must render within 300ms (Requirement 9.4).
 *
 * @param {HTMLElement} root
 * @param {object}      client
 * @param {string}      tabId
 */
function _activateTab(root, client, tabId) {
  const tablist = root.querySelector('[role="tablist"]');
  if (!tablist) return;

  const allButtons = Array.from(tablist.querySelectorAll('[role="tab"]'));
  const allPanels  = Array.from(root.querySelectorAll('[role="tabpanel"]'));

  // Deactivate all tabs
  for (const btn of allButtons) {
    btn.setAttribute('aria-selected', 'false');
    btn.classList.remove('is-active');
    btn.setAttribute('tabindex', '-1');
  }

  // Hide all panels
  for (const panel of allPanels) {
    panel.classList.remove('is-active');
    panel.setAttribute('hidden', '');
  }

  // Activate target tab button
  const targetBtn = tablist.querySelector(`[data-tab-id="${CSS.escape(tabId)}"]`);
  if (targetBtn) {
    targetBtn.setAttribute('aria-selected', 'true');
    targetBtn.classList.add('is-active');
    targetBtn.setAttribute('tabindex', '0');
  }

  // Show target panel
  const targetPanel = root.querySelector(`#tab-panel-${CSS.escape(tabId)}`);
  if (targetPanel) {
    targetPanel.classList.add('is-active');
    targetPanel.removeAttribute('hidden');

    // Render content into the panel (lazy — only if not yet populated)
    _renderTabContent(root, client, tabId);
  }

  // Persist selection (Requirement 9.4)
  _saveTab(client.id, tabId);
}

// ---------------------------------------------------------------------------
// _renderTabContent — delegate to the correct tab renderer
// ---------------------------------------------------------------------------

/**
 * Renders content into the tab panel for `tabId`.
 * Each render call replaces panel content to ensure fresh state.
 *
 * @param {HTMLElement} root
 * @param {object}      client
 * @param {string}      tabId
 */
function _renderTabContent(root, client, tabId) {
  const panel = root.querySelector(`#tab-panel-${CSS.escape(tabId)}`);
  if (!panel) return;

  const tabDef = TABS.find(t => t.id === tabId);
  if (!tabDef) return;

  // Render synchronously — must complete within 300ms (Requirement 9.4)
  tabDef.render(panel, client);
}
