/**
 * nav.js — Navigation module
 *
 * Works with the pre-existing <nav id="main-nav"> and
 * <aside id="scope-disclaimer"> elements in index.html.
 *
 * The nav element already contains 7 .nav-item anchors with
 * data-route attributes matching the router's route names.
 *
 * Requirements: 1.1, 1.2, 1.3, 2.1, 2.3
 */

/**
 * All .nav-item elements with their data-route values, in order:
 *   dashboard, clients, goals, habits, mood, follow-ups, settings
 *
 * The .is-active class defined in layout.css provides two distinguishing
 * visual properties (Req 2.3):
 *   1. background-color: rgba(255, 255, 255, 0.2)
 *   2. font-weight: var(--font-weight-bold)  [700]
 */

const navEl = document.getElementById('main-nav');

/**
 * Sets the active navigation item by toggling the `.is-active` class.
 *
 * @param {string} routeName - The data-route value of the item to activate
 *   (e.g. 'dashboard', 'clients', 'goals', 'habits', 'mood', 'follow-ups', 'settings')
 */
function setActive(routeName) {
  if (!navEl) return;

  const items = navEl.querySelectorAll('.nav-item');

  items.forEach((item) => {
    if (item.dataset.route === routeName) {
      item.classList.add('is-active');
      item.setAttribute('aria-current', 'page');
    } else {
      item.classList.remove('is-active');
      item.removeAttribute('aria-current');
    }
  });
}

export const nav = { setActive };
