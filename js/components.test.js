/**
 * components.test.js — Unit tests for Toast, LoadingIndicator, StatusBadge
 *
 * Requirements: 2.4, 3.4, 18.4, 18.6, 20.2
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Toast, LoadingIndicator, StatusBadge } from './components.js';

// ─── StatusBadge tests ─────────────────────────────────────────────────────────
// StatusBadge.render is a pure function; no DOM needed.

describe('StatusBadge.render', () => {
  describe('Client Status category', () => {
    it('renders Active badge with badge-active class', () => {
      const html = StatusBadge.render('Active', 'Client Status');
      expect(html).toBe('<span class="badge badge-active">Active</span>');
    });

    it('renders Inactive badge with badge-inactive class', () => {
      const html = StatusBadge.render('Inactive', 'Client Status');
      expect(html).toBe('<span class="badge badge-inactive">Inactive</span>');
    });

    it('renders Graduated badge with badge-graduated class', () => {
      const html = StatusBadge.render('Graduated', 'Client Status');
      expect(html).toBe('<span class="badge badge-graduated">Graduated</span>');
    });
  });

  describe('Goal Status category', () => {
    it('renders Not Started badge', () => {
      const html = StatusBadge.render('Not Started', 'Goal Status');
      expect(html).toBe('<span class="badge badge-not-started">Not Started</span>');
    });

    it('renders In Progress badge', () => {
      const html = StatusBadge.render('In Progress', 'Goal Status');
      expect(html).toBe('<span class="badge badge-in-progress">In Progress</span>');
    });

    it('renders Complete badge', () => {
      const html = StatusBadge.render('Complete', 'Goal Status');
      expect(html).toBe('<span class="badge badge-complete">Complete</span>');
    });
  });

  describe('Priority Level category', () => {
    it('renders High badge', () => {
      const html = StatusBadge.render('High', 'Priority');
      expect(html).toBe('<span class="badge badge-high">High</span>');
    });

    it('renders Medium badge', () => {
      const html = StatusBadge.render('Medium', 'Priority');
      expect(html).toBe('<span class="badge badge-medium">Medium</span>');
    });

    it('renders Low badge', () => {
      const html = StatusBadge.render('Low', 'Priority');
      expect(html).toBe('<span class="badge badge-low">Low</span>');
    });
  });

  describe('Unknown / fallback text', () => {
    it('derives a slug class from unknown text', () => {
      const html = StatusBadge.render('Custom Status', 'Client Status');
      expect(html).toBe('<span class="badge badge-custom-status">Custom Status</span>');
    });

    it('strips non-alphanumeric chars when deriving slug', () => {
      const html = StatusBadge.render('Foo & Bar!', 'Other');
      expect(html).toBe('<span class="badge badge-foo--bar">Foo &amp; Bar!</span>');
    });

    it('escapes HTML special characters in the label', () => {
      const html = StatusBadge.render('<script>', 'Client Status');
      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>');
    });
  });

  describe('HTML escaping in text', () => {
    it('escapes ampersands', () => {
      const html = StatusBadge.render('A & B', 'Client Status');
      expect(html).toContain('A &amp; B');
    });

    it('escapes double quotes', () => {
      const html = StatusBadge.render('Say "hi"', 'Client Status');
      expect(html).toContain('&quot;');
    });
  });
});

// ─── LoadingIndicator tests ────────────────────────────────────────────────────
// These tests use jsdom (provided by Vitest's default environment).

describe('LoadingIndicator', () => {
  let el;

  beforeEach(() => {
    // Reset the timer state between tests
    LoadingIndicator._timerId = null;

    // Create a fresh #loading-indicator element in the DOM
    el = document.createElement('div');
    el.id = 'loading-indicator';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);

    vi.useFakeTimers();
  });

  afterEach(() => {
    document.body.removeChild(el);
    vi.useRealTimers();
  });

  it('show() adds is-visible class and sets aria-hidden=false', () => {
    LoadingIndicator.show();
    expect(el.classList.contains('is-visible')).toBe(true);
    expect(el.getAttribute('aria-hidden')).toBe('false');
  });

  it('hide() removes is-visible class and sets aria-hidden=true', () => {
    el.classList.add('is-visible');
    el.setAttribute('aria-hidden', 'false');
    LoadingIndicator.hide();
    expect(el.classList.contains('is-visible')).toBe(false);
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });

  it('showAfter(ms) shows indicator after the given delay', () => {
    LoadingIndicator.showAfter(200);
    expect(el.classList.contains('is-visible')).toBe(false);

    vi.advanceTimersByTime(200);
    expect(el.classList.contains('is-visible')).toBe(true);
  });

  it('hide() cancels a pending showAfter timer', () => {
    LoadingIndicator.showAfter(200);
    LoadingIndicator.hide();
    vi.advanceTimersByTime(300);
    expect(el.classList.contains('is-visible')).toBe(false);
  });

  it('showAfter() replaces a previous pending timer', () => {
    LoadingIndicator.showAfter(500);
    LoadingIndicator.showAfter(100);
    vi.advanceTimersByTime(150);
    // Should have shown after the second (100ms) timer
    expect(el.classList.contains('is-visible')).toBe(true);
  });

  it('show() does nothing when #loading-indicator is absent', () => {
    document.body.removeChild(el);
    // Should not throw
    expect(() => LoadingIndicator.show()).not.toThrow();
    document.body.appendChild(el); // restore for afterEach cleanup
  });

  it('hide() does nothing when #loading-indicator is absent', () => {
    document.body.removeChild(el);
    expect(() => LoadingIndicator.hide()).not.toThrow();
    document.body.appendChild(el);
  });
});

// ─── Toast tests ───────────────────────────────────────────────────────────────

describe('Toast.show', () => {
  let container;
  let liveRegion;

  beforeEach(() => {
    // Create required DOM nodes
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);

    liveRegion = document.createElement('div');
    liveRegion.id = 'live-polite';
    liveRegion.setAttribute('role', 'status');
    document.body.appendChild(liveRegion);

    vi.useFakeTimers();
  });

  afterEach(() => {
    document.body.removeChild(container);
    document.body.removeChild(liveRegion);
    vi.useRealTimers();
  });

  it('appends a toast element to #toast-container', () => {
    Toast.show('Hello!');
    expect(container.children.length).toBe(1);
  });

  it('applies the correct type class (success)', () => {
    Toast.show('Saved', 'success');
    const toast = container.querySelector('.toast');
    expect(toast.classList.contains('toast-success')).toBe(true);
  });

  it('applies the correct type class (warning)', () => {
    Toast.show('Watch out', 'warning');
    expect(container.querySelector('.toast-warning')).not.toBeNull();
  });

  it('applies the correct type class (error)', () => {
    Toast.show('Error!', 'error');
    expect(container.querySelector('.toast-error')).not.toBeNull();
  });

  it('defaults to info type when type is omitted', () => {
    Toast.show('FYI');
    expect(container.querySelector('.toast-info')).not.toBeNull();
  });

  it('falls back to info for an unknown type', () => {
    Toast.show('Hmm', 'unknown-type');
    expect(container.querySelector('.toast-info')).not.toBeNull();
  });

  it('sets the live region textContent for screen reader announcement', () => {
    Toast.show('Saved successfully', 'success');
    // After setTimeout(0) fires
    vi.advanceTimersByTime(0);
    expect(liveRegion.textContent).toBe('Saved successfully');
  });

  it('escapes HTML in the message', () => {
    Toast.show('<b>bold</b>', 'info');
    const toast = container.querySelector('.toast');
    expect(toast.innerHTML).toContain('&lt;b&gt;bold&lt;/b&gt;');
    expect(toast.innerHTML).not.toContain('<b>bold</b>');
  });

  it('adds is-visible class on next animation frame (simulated with timers)', () => {
    Toast.show('Hi');
    const toast = container.querySelector('.toast');
    // Before rAF fires
    expect(toast.classList.contains('is-visible')).toBe(false);
    // Simulate rAF via fake timers (jsdom rAF uses setTimeout internally)
    vi.advanceTimersByTime(32); // two frames at ~16ms each
    expect(toast.classList.contains('is-visible')).toBe(true);
  });

  it('removes toast from DOM after 4000ms + transition', () => {
    Toast.show('Goodbye');
    const toast = container.querySelector('.toast');
    expect(toast.parentNode).not.toBeNull();

    // Advance past auto-dismiss delay + transition (~200ms)
    vi.advanceTimersByTime(4250);
    expect(toast.parentNode).toBeNull();
  });

  it('does not trap focus — no focus-related attributes on toast', () => {
    Toast.show('No focus trap');
    const toast = container.querySelector('.toast');
    expect(toast.getAttribute('tabindex')).toBeNull();
    expect(toast.hasAttribute('autofocus')).toBe(false);
  });

  it('creates #toast-container if it does not exist in DOM', () => {
    document.body.removeChild(container);
    Toast.show('Auto container');
    const newContainer = document.getElementById('toast-container');
    expect(newContainer).not.toBeNull();
    // Restore for afterEach
    container = newContainer;
  });
});

// ─── SortableTable tests ───────────────────────────────────────────────────────
// Requirements: 5.3, 7.1, 19.2, 19.4

import { SortableTable } from './components.js';

describe('SortableTable', () => {
  const columns = [
    { key: 'name',   label: 'Name' },
    { key: 'age',    label: 'Age' },
    { key: 'status', label: 'Status', sortable: false },
  ];

  const data = [
    { name: 'Charlie', age: 30, status: 'Active' },
    { name: 'Alice',   age: 25, status: 'Inactive' },
    { name: 'Bob',     age: 35, status: 'Active' },
  ];

  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  // ── Constructor / initial render ─────────────────────────────────────────

  it('renders a table-wrapper, table, thead, and tbody', () => {
    new SortableTable(container, columns, data);
    expect(container.querySelector('.table-wrapper')).not.toBeNull();
    expect(container.querySelector('table.table')).not.toBeNull();
    expect(container.querySelector('thead')).not.toBeNull();
    expect(container.querySelector('tbody')).not.toBeNull();
  });

  it('renders one <th> per column', () => {
    new SortableTable(container, columns, data);
    const ths = container.querySelectorAll('thead th');
    expect(ths.length).toBe(3);
  });

  it('renders one <tr> per data row in tbody', () => {
    new SortableTable(container, columns, data);
    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);
  });

  it('renders correct cell text for each record', () => {
    new SortableTable(container, columns, [{ name: 'Zara', age: 28, status: 'Active' }]);
    const cells = container.querySelectorAll('tbody td');
    expect(cells[0].textContent).toBe('Zara');
    expect(cells[1].textContent).toBe('28');
    expect(cells[2].textContent).toBe('Active');
  });

  // ── Empty state ──────────────────────────────────────────────────────────

  it('renders .empty-state when data array is empty', () => {
    new SortableTable(container, columns, []);
    expect(container.querySelector('.empty-state')).not.toBeNull();
    expect(container.querySelector('table')).toBeNull();
  });

  it('shows default empty message when no emptyMessage option is provided', () => {
    new SortableTable(container, columns, []);
    expect(container.querySelector('.empty-state p').textContent).toBe('No records found.');
  });

  it('shows custom emptyMessage when provided', () => {
    new SortableTable(container, columns, [], { emptyMessage: 'No clients yet.' });
    expect(container.querySelector('.empty-state p').textContent).toBe('No clients yet.');
  });

  // ── Sortable column headers ──────────────────────────────────────────────

  it('adds tabindex="0" on sortable column headers', () => {
    new SortableTable(container, columns, data);
    const nameTh = container.querySelectorAll('thead th')[0];
    expect(nameTh.getAttribute('tabindex')).toBe('0');
  });

  it('does NOT add tabindex to non-sortable column headers', () => {
    new SortableTable(container, columns, data);
    const statusTh = container.querySelectorAll('thead th')[2];
    expect(statusTh.getAttribute('tabindex')).toBeNull();
  });

  it('sets aria-sort="none" on inactive sortable headers', () => {
    new SortableTable(container, columns, data);
    const nameTh = container.querySelectorAll('thead th')[0];
    expect(nameTh.getAttribute('aria-sort')).toBe('none');
  });

  it('renders a .sort-indicator span inside each sortable header', () => {
    new SortableTable(container, columns, data);
    const indicators = container.querySelectorAll('thead th .sort-indicator');
    // Two sortable columns (name, age); one non-sortable (status)
    expect(indicators.length).toBe(2);
  });

  // ── Sort behaviour ───────────────────────────────────────────────────────

  it('clicking a column header sorts rows ascending by that column', () => {
    new SortableTable(container, columns, data);
    const nameTh = container.querySelectorAll('thead th')[0];
    nameTh.click();

    const rows = container.querySelectorAll('tbody tr');
    expect(rows[0].querySelectorAll('td')[0].textContent).toBe('Alice');
    expect(rows[1].querySelectorAll('td')[0].textContent).toBe('Bob');
    expect(rows[2].querySelectorAll('td')[0].textContent).toBe('Charlie');
  });

  it('clicking the same header a second time sorts descending', () => {
    new SortableTable(container, columns, data);
    const nameTh = container.querySelectorAll('thead th')[0];
    nameTh.click(); // asc
    nameTh.click(); // desc

    const rows = container.querySelectorAll('tbody tr');
    expect(rows[0].querySelectorAll('td')[0].textContent).toBe('Charlie');
    expect(rows[2].querySelectorAll('td')[0].textContent).toBe('Alice');
  });

  it('clicking a different column resets direction to ascending', () => {
    new SortableTable(container, columns, data);
    const nameTh = container.querySelectorAll('thead th')[0];
    const ageTh  = container.querySelectorAll('thead th')[1];

    nameTh.click(); // sort by name asc
    nameTh.click(); // sort by name desc
    ageTh.click();  // switch to age — should reset to asc

    const rows = container.querySelectorAll('tbody tr');
    // age asc: Alice(25), Charlie(30), Bob(35)
    expect(rows[0].querySelectorAll('td')[1].textContent).toBe('25');
    expect(rows[2].querySelectorAll('td')[1].textContent).toBe('35');
  });

  it('sets aria-sort="ascending" on the active column after first click', () => {
    new SortableTable(container, columns, data);
    const nameTh = container.querySelectorAll('thead th')[0];
    nameTh.click();
    expect(nameTh.getAttribute('aria-sort')).toBe('ascending');
  });

  it('sets aria-sort="descending" on the active column after second click', () => {
    new SortableTable(container, columns, data);
    const nameTh = container.querySelectorAll('thead th')[0];
    nameTh.click();
    nameTh.click();
    expect(nameTh.getAttribute('aria-sort')).toBe('descending');
  });

  it('applies defaultSort option on initial render', () => {
    new SortableTable(container, columns, data, { defaultSort: { key: 'name', direction: 'asc' } });
    const rows = container.querySelectorAll('tbody tr');
    expect(rows[0].querySelectorAll('td')[0].textContent).toBe('Alice');
  });

  // ── Keyboard accessibility (Req 19.4) ────────────────────────────────────

  it('Enter key on a sortable header triggers sort', () => {
    new SortableTable(container, columns, data);
    const nameTh = container.querySelectorAll('thead th')[0];
    nameTh.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    const rows = container.querySelectorAll('tbody tr');
    expect(rows[0].querySelectorAll('td')[0].textContent).toBe('Alice');
  });

  it('Space key on a sortable header triggers sort', () => {
    new SortableTable(container, columns, data);
    const nameTh = container.querySelectorAll('thead th')[0];
    nameTh.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

    const rows = container.querySelectorAll('tbody tr');
    expect(rows[0].querySelectorAll('td')[0].textContent).toBe('Alice');
  });

  // ── Row click (onRowClick callback) ──────────────────────────────────────

  it('adds .row-clickable class to tbody rows when onRowClick is provided', () => {
    new SortableTable(container, columns, data, { onRowClick: () => {} });
    const rows = container.querySelectorAll('tbody tr');
    rows.forEach(row => expect(row.classList.contains('row-clickable')).toBe(true));
  });

  it('does NOT add .row-clickable when onRowClick is not provided', () => {
    new SortableTable(container, columns, data);
    const rows = container.querySelectorAll('tbody tr');
    rows.forEach(row => expect(row.classList.contains('row-clickable')).toBe(false));
  });

  it('calls onRowClick with the correct record when a row is clicked', () => {
    const onClick = vi.fn();
    new SortableTable(container, columns, data, { onRowClick: onClick });
    // Click the first rendered row (Charlie, age 30)
    const firstRow = container.querySelector('tbody tr');
    firstRow.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.calls[0][0]).toEqual(data[0]);
  });

  it('calls onRowClick on Enter key press for row', () => {
    const onClick = vi.fn();
    new SortableTable(container, columns, data, { onRowClick: onClick });
    const firstRow = container.querySelector('tbody tr');
    firstRow.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  // ── update() method ──────────────────────────────────────────────────────

  it('update() replaces data and re-renders', () => {
    const st = new SortableTable(container, columns, data);
    st.update([{ name: 'Zara', age: 22, status: 'Active' }]);
    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(1);
    expect(rows[0].querySelectorAll('td')[0].textContent).toBe('Zara');
  });

  it('update() with empty array shows empty state', () => {
    const st = new SortableTable(container, columns, data);
    st.update([]);
    expect(container.querySelector('.empty-state')).not.toBeNull();
    expect(container.querySelector('table')).toBeNull();
  });

  // ── Custom render function ───────────────────────────────────────────────

  it('uses column render() function to produce cell HTML', () => {
    const colsWithRender = [
      { key: 'name', label: 'Name' },
      { key: 'status', label: 'Status', render: (v) => `<strong>${v}</strong>` },
    ];
    new SortableTable(container, colsWithRender, [{ name: 'Alice', status: 'Active' }]);
    const cells = container.querySelectorAll('tbody td');
    expect(cells[1].innerHTML).toBe('<strong>Active</strong>');
  });

  // ── Null / undefined cell values ─────────────────────────────────────────

  it('renders empty string for null/undefined field values', () => {
    const st = new SortableTable(container, columns, [{ name: null, age: undefined, status: '' }]);
    const cells = container.querySelectorAll('tbody td');
    expect(cells[0].textContent).toBe('');
    expect(cells[1].textContent).toBe('');
    expect(cells[2].textContent).toBe('');
  });

  // ── role and scope attributes ─────────────────────────────────────────────

  it('sets role="columnheader" on all th elements', () => {
    new SortableTable(container, columns, data);
    const ths = container.querySelectorAll('thead th');
    ths.forEach(th => expect(th.getAttribute('role')).toBe('columnheader'));
  });

  it('sets scope="col" on all th elements', () => {
    new SortableTable(container, columns, data);
    const ths = container.querySelectorAll('thead th');
    ths.forEach(th => expect(th.getAttribute('scope')).toBe('col'));
  });
});
