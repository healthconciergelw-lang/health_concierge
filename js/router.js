/**
 * router.js — Hash-based SPA router for Health Concierge Tracker
 *
 * Route table:
 *   #/             → dashboard
 *   #/dashboard    → dashboard
 *   #/clients      → clients
 *   #/clients/:id  → clientProfile  (param: id)
 *   #/goals        → goals
 *   #/habits       → habits
 *   #/mood         → moodEnergy
 *   #/follow-ups   → followUps
 *   #/settings     → settings
 *
 * Requirements: 2.2, 2.4
 */

import * as dashboard     from './modules/dashboard.js';
import * as clients       from './modules/clients.js';
import * as clientProfile from './modules/clientProfile.js';
import * as goals         from './modules/goals.js';
import * as habits        from './modules/habits.js';
import * as moodEnergy    from './modules/moodEnergy.js';
import * as followUps     from './modules/followUps.js';
import * as settings      from './modules/settings.js';
import { nav }            from './modules/nav.js';
import { LoadingIndicator } from './components.js';

// ---------------------------------------------------------------------------
// Route definitions
// Each entry: { pattern: RegExp, module, routeName, paramNames }
// ---------------------------------------------------------------------------

const ROUTE_DEFS = [
  {
    // #/ or #/dashboard
    pattern: /^#\/(dashboard)?$/,
    module: dashboard,
    routeName: 'dashboard',
    paramNames: [],
  },
  {
    // #/clients/:id  — must come before the plain /clients route
    pattern: /^#\/clients\/([^/]+)$/,
    module: clientProfile,
    routeName: 'clientProfile',
    paramNames: ['id'],
  },
  {
    // #/clients
    pattern: /^#\/clients$/,
    module: clients,
    routeName: 'clients',
    paramNames: [],
  },
  {
    // #/goals
    pattern: /^#\/goals$/,
    module: goals,
    routeName: 'goals',
    paramNames: [],
  },
  {
    // #/habits
    pattern: /^#\/habits$/,
    module: habits,
    routeName: 'habits',
    paramNames: [],
  },
  {
    // #/mood
    pattern: /^#\/mood$/,
    module: moodEnergy,
    routeName: 'mood',
    paramNames: [],
  },
  {
    // #/follow-ups
    pattern: /^#\/follow-ups$/,
    module: followUps,
    routeName: 'follow-ups',
    paramNames: [],
  },
  {
    // #/settings
    pattern: /^#\/settings$/,
    module: settings,
    routeName: 'settings',
    paramNames: [],
  },
];

/** Render timeout in milliseconds (Requirement 2.2) */
const RENDER_TIMEOUT_MS = 5000;

// ---------------------------------------------------------------------------
// matchRoute
// ---------------------------------------------------------------------------

/**
 * Matches a hash string against the route definitions.
 *
 * @param {string} hash  e.g. "#/clients/abc-123"
 * @returns {{ module: object, routeName: string, params: object } | null}
 */
export function matchRoute(hash) {
  const normalised = hash || '#/';

  for (const def of ROUTE_DEFS) {
    const match = normalised.match(def.pattern);
    if (match) {
      // Build params object from named capture groups
      const params = {};
      def.paramNames.forEach((name, index) => {
        // match[1] is the first capture group, match[2] the second, etc.
        params[name] = match[index + 1];
      });
      return { module: def.module, routeName: def.routeName, params };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// showRouteError — renders an error message inside #app-root
// ---------------------------------------------------------------------------

/**
 * Displays an error message in the app root element.
 *
 * @param {string} message
 */
function showRouteError(message) {
  const root = document.getElementById('app-root');
  if (!root) return;

  root.innerHTML = `
    <div class="route-error" role="alert" aria-live="assertive">
      <p class="route-error__message">${escapeHtml(message)}</p>
    </div>
  `;
}

/**
 * Minimal HTML escaping to prevent XSS in error messages.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// handleNavigation — core routing logic
// ---------------------------------------------------------------------------

/**
 * Resolves the current hash to a module and renders it.
 * Integrates LoadingIndicator (Requirement 2.4) and a 5-second render
 * timeout (Requirement 2.2).
 */
async function handleNavigation() {
  const hash = location.hash || '#/';
  const root = document.getElementById('app-root');

  // Resolve route
  const route = matchRoute(hash);

  if (!route) {
    showRouteError(`Page not found: ${hash}`);
    return;
  }

  const { module, routeName, params } = route;

  // --- Loading indicator (Requirement 2.4) ---------------------------------
  // showAfter(200) means the spinner only appears if render takes > 200 ms.
  LoadingIndicator.showAfter(200);

  // --- 5-second render timeout (Requirement 2.2) ---------------------------
  let timeoutId = null;
  let timedOut = false;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      reject(new Error(
        `The "${routeName}" screen took too long to load. Please try again.`
      ));
    }, RENDER_TIMEOUT_MS);
  });

  // --- Render --------------------------------------------------------------
  const renderPromise = (async () => {
    await module.render(root, params);
  })();

  try {
    await Promise.race([renderPromise, timeoutPromise]);

    // Render completed successfully
    clearTimeout(timeoutId);
    LoadingIndicator.hide();
    nav.setActive(routeName);
  } catch (err) {
    // Either a timeout or a render exception
    clearTimeout(timeoutId);
    LoadingIndicator.hide();

    // Do NOT change location.hash — keep the coach on the current screen
    showRouteError(
      err && err.message
        ? err.message
        : 'An unexpected error occurred while loading the page.'
    );

    // Log to console for debugging without surfacing internals to the user
    console.error('[router] Navigation error for hash', hash, err);
  }
}

// ---------------------------------------------------------------------------
// initRouter — public entry point
// ---------------------------------------------------------------------------

/**
 * Attaches event listeners and processes the initial route.
 * Call once from `main.js` after the DOM is ready.
 */
export function initRouter() {
  window.addEventListener('hashchange', handleNavigation);
  window.addEventListener('load', handleNavigation);

  // If the page has already fired 'load' (e.g. script is deferred/module),
  // trigger routing immediately so the correct screen is shown.
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    handleNavigation();
  }
}
