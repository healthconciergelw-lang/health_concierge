/**
 * main.js — Application bootstrap
 *
 * Execution order on DOMContentLoaded:
 *   1. store.load()          — hydrate in-memory state from localStorage
 *   2. Storage banner        — if localStorage is unavailable, show a
 *                              persistent warning before any module renders
 *   3. First-launch seed     — if `hc:initialized` is absent, seed mock data
 *                              and set the flag so seeding only happens once
 *   4. initRouter()          — start hash-based SPA routing
 *
 * Requirements: 3.6, 17.2
 */

import { store } from './store.js';
import { seedMockData } from './mockData.js';
import { initRouter } from './router.js';       // created in a later task
import { nav } from './modules/nav.js';         // created in a later task

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  // ── Step 1: Hydrate in-memory state ──────────────────────────────────────
  store.load();

  // ── Step 2: Persistent storage-unavailable banner ────────────────────────
  if (store.storageUnavailable) {
    _showStorageBanner();
  }

  // ── Step 3: First-launch mock data seed ───────────────────────────────────
  if (store.storageUnavailable) {
    // localStorage is not accessible — seed into memory only.
    // Skip the initialized flag check since we cannot read or write it.
    seedMockData(store);
  } else {
    const initialized = localStorage.getItem('hc:initialized');
    if (initialized === null) {
      seedMockData(store);
      localStorage.setItem('hc:initialized', 'true');
    }
  }

  // ── Step 4: Start SPA routing ─────────────────────────────────────────────
  initRouter();
});

// ---------------------------------------------------------------------------
// Storage banner
// ---------------------------------------------------------------------------

/**
 * Injects a persistent, role="alert" banner into #app-root warning the coach
 * that data will not be saved across sessions.
 *
 * The banner is prepended so it appears above any module content, and it is
 * never removed — it remains visible for the entire session.
 */
function _showStorageBanner() {
  const appRoot = document.getElementById('app-root');
  if (!appRoot) return;

  const banner = document.createElement('div');
  banner.id = 'storage-unavailable-banner';
  banner.setAttribute('role', 'alert');
  banner.setAttribute('aria-live', 'assertive');
  banner.setAttribute('aria-atomic', 'true');

  banner.style.cssText = [
    'display: flex',
    'align-items: center',
    'gap: 0.5rem',
    'padding: 0.75rem 1rem',
    'background-color: #FED7D7',
    'color: #742A2A',
    'border-left: 4px solid #E53E3E',
    'font-size: 0.875rem',
    'font-weight: 500',
    'position: sticky',
    'top: 0',
    'z-index: 100',
  ].join('; ');

  banner.innerHTML = `
    <svg aria-hidden="true" focusable="false" width="18" height="18"
         viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
    <span>
      <strong>Session only:</strong> Local storage is unavailable in this browser context.
      Your data will not be saved when you close or refresh the page.
    </span>
  `.trim();

  appRoot.prepend(banner);
}
