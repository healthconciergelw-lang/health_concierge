# Design Document: Health Concierge Tracker

## Overview

Health Concierge is a fully client-side single-page application (SPA) that gives a concierge health coach a professional tool for managing a client roster, tracking wellness goals, habits, mood/energy, and coaching notes. There is no backend server; all persistence happens in the browser via localStorage. The application runs from static files (HTML, CSS, vanilla JS), requires no build toolchain, and ships with mock data pre-loaded on first launch.

The design prioritises:
- **Zero dependencies on a bundler or server** — a coach can open `index.html` from a local folder or a simple static host
- **Correctness and data integrity** — especially around the JSON round-trip export/import guarantee
- **Premium, accessible UI** — WCAG 2.1 AA, design token system, smooth CSS transitions
- **Maintainability** — a clear module boundary for each screen, a single source-of-truth store, and an explicit data-access layer

---

## Architecture

### High-Level Structure

```
index.html
├── styles/
│   ├── tokens.css          ← CSS custom properties (colors, type, spacing, radii, shadows)
│   ├── base.css            ← reset, body, typography scale
│   ├── components.css      ← reusable UI: buttons, badges, modals, tables, forms
│   └── layout.css          ← nav, main content area, responsive breakpoints
└── js/
    ├── main.js             ← bootstrap, router init, live-region setup
    ├── router.js           ← hash-based router
    ├── store.js            ← in-memory state + localStorage adapter
    ├── db.js               ← all read/write helpers (the "data layer")
    ├── mockData.js         ← seed data for first launch
    ├── utils.js            ← date helpers, id generators, format utilities
    ├── validation.js       ← shared field validators
    ├── exportImport.js     ← JSON serialisation / deserialisation + round-trip logic
    └── modules/
        ├── nav.js
        ├── dashboard.js
        ├── clients.js
        ├── clientProfile.js
        ├── goals.js
        ├── habits.js
        ├── moodEnergy.js
        ├── followUps.js
        └── settings.js
```

### Data Flow

```
User action
    │
    ▼
Module handler (e.g. goals.js)
    │  calls
    ▼
db.js  ─── writes ──► store.js (in-memory)
    │                      │
    │                      └── writes to localStorage (within 300 ms)
    │
    └── returns updated data
          │
          ▼
     Module re-renders affected DOM section
          │
          ▼
     aria-live region announced (polite or assertive)
```

There is no virtual DOM diffing. Each module owns a `<section>` or `<div>` root element and calls its own `render()` function when data changes. This is intentional: the data set for a single coaching practice is small enough that full re-render of a module is imperceptible.

### SPA Shell

`index.html` contains:
- The top navigation bar (persistent)
- The scope disclaimer banner (persistent)
- A `<main id="app-root">` where modules render
- ARIA live regions (`role="status"` for polite, `role="alert"` for assertive)
- A `<div id="modal-root">` for dialogs (rendered above everything via `position: fixed`)
- `<div id="loading-indicator">` (hidden until needed)

---

## Technology Stack

| Concern | Choice | Rationale |
|---|---|---|
| Language | Vanilla ES2020+ (modules via `<script type="module">`) | No bundler needed; `import`/`export` work in every modern browser |
| Styling | CSS custom properties + plain CSS | Full design token system without preprocessors |
| Charting | [Chart.js 4.x](https://www.chartjs.org/) via CDN | Lightweight (~60 KB gzip), excellent accessibility support (`aria-label` on canvas), actively maintained, no build step, MIT licence |
| Testing | [fast-check](https://github.com/dubzzz/fast-check) + [Vitest](https://vitest.dev/) via CDN/Node | fast-check is the leading JS property-based testing library; Vitest is the modern Jest replacement |
| Persistence | `localStorage` (primary) with graceful degradation message | Synchronous, universally available; 5–10 MB limit is sufficient for coaching records |
| Icons | Inline SVG sprites | No icon-font dependency, accessible with `<title>` and `aria-hidden` |
| Fonts | System font stack | No external font request; looks native on macOS/Windows/iOS |

### Why Not a Framework?

React/Vue/Svelte would be appropriate for a larger team or longer-lived app. For this project:
- No build step keeps deployment trivial (open `index.html`)
- The data set is small; fine-grained reactivity buys nothing
- A small module per screen is already well-structured and testable
- Vanilla JS is auditable by non-JS-experts (coaches, accessibility reviewers)

Chart.js is loaded from CDN (`<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js">`). All other code is local.

---

## Data Models

All records are plain JavaScript objects stored as JSON in localStorage.

### Client

```ts
interface Client {
  id: string;            // UUID v4, system-generated
  clientId: string;      // Coach-assigned, unique, /^[A-Za-z0-9-]{1,50}$/
  fullName: string;      // max 100 chars
  startWeight: number;   // lbs, 1.0–2000.0
  currentWeight: number; // lbs, 1.0–2000.0
  nextAppointment: string | null; // ISO date "YYYY-MM-DD" or null
  priorityLevel: string; // reference to Settings.priorityLevels item
  status: string;        // reference to Settings.clientStatusValues item
  supportStyle: string;  // reference to Settings.supportStyles item
  createdAt: string;     // ISO 8601 datetime
  updatedAt: string;     // ISO 8601 datetime
}
```

### Goal

```ts
interface Goal {
  id: string;            // UUID v4
  clientId: string;      // FK → Client.id
  description: string;   // max 200 chars
  whyItMatters: string;  // max 500 chars, optional (empty string if not provided)
  targetDate: string | null; // ISO date or null
  status: string;        // reference to Settings.goalStatusValues item
  completedDate: string | null; // ISO date, set automatically when status → Complete
  createdAt: string;
  updatedAt: string;
}
```

### Habit (assignment + weekly completion)

The habit system uses two sub-models:

```ts
// A habit assigned to a client
interface HabitAssignment {
  id: string;        // UUID v4
  clientId: string;  // FK → Client.id
  habitName: string; // reference to Settings.commonHabits item
  createdAt: string;
}

// A single day's completion record
interface HabitCompletion {
  id: string;            // UUID v4
  habitAssignmentId: string; // FK → HabitAssignment.id
  date: string;          // ISO date "YYYY-MM-DD"
  completed: boolean;
}
```

Separating assignment from completion keeps the weekly grid logic clean: the grid is rendered by joining HabitAssignments (one row per client × habit) with HabitCompletions (filtered to the displayed week).

### Check-In

```ts
interface CheckIn {
  id: string;          // UUID v4
  clientId: string;    // FK → Client.id
  date: string;        // ISO date "YYYY-MM-DD"
  moodScore: number;   // integer 1–10
  energyScore: number; // integer 1–10
  notes: string;       // max 500 chars, optional
  createdAt: string;
  updatedAt: string;
}
```

### Follow-Up Note

```ts
interface FollowUpNote {
  id: string;       // UUID v4
  clientId: string; // FK → Client.id
  date: string;     // ISO date "YYYY-MM-DD"
  noteText: string; // 1–2000 chars, at least 1 non-whitespace char
  createdAt: string;
  updatedAt: string;
}
```

### Settings

```ts
interface Settings {
  commonHabits: string[];       // default 7 items
  supportStyles: string[];      // default 5 items
  priorityLevels: string[];     // default 3 items
  clientStatusValues: string[]; // default 3 items
  goalStatusValues: string[];   // default 3 items
}
```

---

## localStorage Schema

All data lives in a single namespace. Keys:

| Key | Value | Notes |
|---|---|---|
| `hc:clients` | `Client[]` JSON | |
| `hc:goals` | `Goal[]` JSON | |
| `hc:habitAssignments` | `HabitAssignment[]` JSON | |
| `hc:habitCompletions` | `HabitCompletion[]` JSON | |
| `hc:checkIns` | `CheckIn[]` JSON | |
| `hc:followUpNotes` | `FollowUpNote[]` JSON | |
| `hc:settings` | `Settings` JSON | |
| `hc:initialized` | `"true"` | Set after first-launch mock data seed |

### Key Design Rationale

- The `hc:` namespace prefix avoids collisions with other apps on the same origin.
- Each collection is a single JSON array, not one key per record. This keeps the key count low and makes atomic replace (used during import) straightforward.
- `store.js` keeps a mirrored in-memory copy of every collection. Reads always come from memory (fast, synchronous). Writes flush to localStorage within 300 ms.

### Write Strategy

```js
// store.js — pseudocode
function persist(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // quota exceeded or access denied
    announceError('Change saved in memory only. Data will be lost on reload.');
  }
}
```

On write failure the in-memory state is kept (the user's action succeeded) but a polite warning is announced. A separate check on startup detects whether localStorage is completely unavailable (private browsing on some browsers) and shows a persistent session-level warning.

---

## Components and Interfaces

### Shared Components (`components.js`)

| Component | API | Notes |
|---|---|---|
| `Modal` | `Modal.open(title, bodyHTML, {onConfirm, onCancel})` | Focus trap, ESC closes, aria-modal |
| `ConfirmDialog` | `ConfirmDialog.open(message)` → Promise<bool> | Wraps Modal; returns true on confirm |
| `Toast` | `Toast.show(message, type)` | Non-blocking; aria-live="polite"; auto-dismiss 4s |
| `LoadingIndicator` | `LoadingIndicator.show() / hide()` | Shown after 200ms of pending load |
| `StatusBadge` | `StatusBadge.render(text, category)` | Returns HTML string for inline injection |
| `SortableTable` | `new SortableTable(container, columns, data)` | Handles click-to-sort state; emits sorted events |
| `FormValidator` | `new FormValidator(formEl)` | Registers fields, runs validation, renders errors |

### Navigation (`nav.js`)

Renders the `<nav>` with 7 top-level items. On router navigation, `nav.setActive(routeName)` updates the active item (two visual properties: `background-color` change + `font-weight: 700`). The nav also renders the disclaimer banner as a `<aside role="note">` directly below the nav bar.

### Dashboard (`dashboard.js`)

Computes all summary statistics from in-memory store on each render. Statistics are never cached between renders to ensure freshness.

Sub-sections:
1. **Stats strip** — 6 metric cards (Active Clients, Total lbs Lost, Goals Completed, Avg Habit Completion, Avg Mood, Avg Energy)
2. **Client Roster table** — uses `SortableTable`; status filter select
3. **Upcoming Appointments** — filtered list, sorted ascending by date
4. **Recent Follow-Ups** — top 5, truncated to 80 chars

All date arithmetic uses `utils.js` helper functions (described under Utilities).

### Clients (`clients.js`)

- Search input filters full-name case-insensitively, debounced to 300 ms
- `SortableTable` with Name, Client ID, Priority, Status, Next Appointment, Actions
- "Add Client" → opens `clientForm` in a modal
- View → router navigates to `/client/:id`
- Edit → opens `clientForm` pre-populated
- Delete → `ConfirmDialog` → `db.deleteClient(id)` (cascades to all child records)

### Client Profile (`clientProfile.js`)

- Persistent header: name, clientId, priority badge, status badge
- Tab strip with 5 tabs; tab state stored in `sessionStorage` keyed by client id
- Disclaimer banner rendered in this view as well
- Each tab (`intake`, `goals`, `habits`, `moodEnergy`, `followUpNotes`) is a sub-module that re-uses the corresponding global module's render function with a `clientId` filter applied

### Goals (`goals.js`)

- Global view: all goals, filterable by status dropdown
- Profile view: pre-filtered + client locked
- `completedDate` auto-set/cleared in `db.saveGoal()` when status transitions

### Habits (`habits.js`)

- Week picker: `<input type="date">` drives `getISOWeek(date)` → Monday–Sunday range
- Previous/Next controls shift by 7 days
- Grid: one row per `(client, habitAssignment)` pair; 7 checkbox columns
- Checkbox `change` event → `db.setHabitCompletion(habitAssignmentId, date, checked)`
- Per-client completion % computed inline during render

### Mood & Energy (`moodEnergy.js`)

- List view: all check-ins, sorted descending
- Client filter select → shows trend chart for selected client (Chart.js line chart)
- Chart not rendered when < 2 check-ins exist for the selected client
- Chart.js config: two datasets (`moodScore`, `energyScore`), X-axis time scale, Y-axis 1–10, legend enabled, ARIA label on canvas element

### Follow-Ups (`followUps.js`)

- Search input filters on client name + note text, debounced 300 ms
- Note Preview: `text.length > 100 ? text.slice(0, 100) + '…' : text`
- Profile view: pre-filtered + client locked

### Settings (`settings.js`)

Five editable lists rendered as `<ul>` with inline delete buttons and an "Add item" text input + button per list. Validation: 1–50 chars, no case-insensitive duplicate within the same list. Deletion: warns if item is in use (count + names), prevents deletion of last item.

On confirmed deletion, `db.deleteReferenceItem(listKey, value)` replaces the string value in all referencing records with `value + ' (removed)'` (a legacy label, not a broken FK).

---

## State Management

There is no reactive framework. State is managed as follows:

```
store.js
  state = {
    clients: [],
    goals: [],
    habitAssignments: [],
    habitCompletions: [],
    checkIns: [],
    followUpNotes: [],
    settings: { ... }
  }

  // Methods
  load()          — reads all collections from localStorage into state
  get(key)        — returns a shallow copy of state[key]
  set(key, value) — sets state[key] and calls persist(key, value)
```

Modules call `store.get()` to read and `db.*` helpers to write (which internally call `store.set()`). There is no subscription/observer pattern; after a write the calling module explicitly re-renders its own DOM section. For cross-module consistency (e.g., dashboard stats updating after a goal is saved from the Goals screen), each module's `render()` is called fresh when the route activates.

This is intentionally simple. The data set (dozens to low hundreds of records) makes full module re-renders on every activation imperceptibly fast.

---

## Navigation and Routing

### Hash-Based Router

Hash routing (`#/route`) is used so:
- No server configuration is required (the app works from `file://`)
- The back button works naturally
- Deep links work without a server rewrite rule

### Route Table

| Hash | Module | Notes |
|---|---|---|
| `#/` or `#/dashboard` | dashboard | Default route |
| `#/clients` | clients | Roster list |
| `#/clients/:id` | clientProfile | `:id` is `Client.id` (UUID) |
| `#/goals` | goals | Global goals view |
| `#/habits` | habits | Weekly habits grid |
| `#/mood` | moodEnergy | Check-in log + chart |
| `#/follow-ups` | followUps | Notes log |
| `#/settings` | settings | Reference data + export/import |

### Router Implementation

```js
// router.js — pseudocode
const routes = { ... };

window.addEventListener('hashchange', handleNavigation);
window.addEventListener('load', handleNavigation);

function handleNavigation() {
  const hash = location.hash || '#/';
  const { module, params } = matchRoute(hash, routes);
  LoadingIndicator.showAfter(200); // only shown if render takes > 200ms
  module.render(document.getElementById('app-root'), params);
  LoadingIndicator.hide();
  nav.setActive(module.name);
}
```

Navigation failure handling: if `module.render()` throws, the error is caught, `LoadingIndicator.hide()` is called, and an error message is displayed in `app-root` without changing the hash — the coach remains on the current screen.

---

## Design Token System

All tokens are defined in `styles/tokens.css` as CSS custom properties on `:root`.

### Color Palette

```css
:root {
  /* Brand */
  --color-brand-primary:    #2C7A7B; /* deep teal */
  --color-brand-secondary:  #38A169; /* forest green */
  --color-brand-accent:     #D69E2E; /* warm gold */

  /* Neutral */
  --color-neutral-50:   #F7FAFC;
  --color-neutral-100:  #EDF2F7;
  --color-neutral-200:  #E2E8F0;
  --color-neutral-300:  #CBD5E0;
  --color-neutral-400:  #A0AEC0;
  --color-neutral-500:  #718096;
  --color-neutral-600:  #4A5568;
  --color-neutral-700:  #2D3748;
  --color-neutral-800:  #1A202C;

  /* Semantic */
  --color-surface:         var(--color-neutral-50);
  --color-surface-raised:  #FFFFFF;
  --color-border:          var(--color-neutral-200);
  --color-text-primary:    var(--color-neutral-800);
  --color-text-secondary:  var(--color-neutral-500);
  --color-text-inverse:    #FFFFFF;
  --color-focus-ring:      #3182CE;

  /* Status Badges — Client Status */
  --badge-active-bg:     #C6F6D5; --badge-active-fg:     #22543D;
  --badge-inactive-bg:   #FED7D7; --badge-inactive-fg:   #742A2A;
  --badge-graduated-bg:  #BEE3F8; --badge-graduated-fg:  #2A4365;

  /* Status Badges — Goal Status */
  --badge-not-started-bg: #EDF2F7; --badge-not-started-fg: #2D3748;
  --badge-in-progress-bg: #FEFCBF; --badge-in-progress-fg: #744210;
  --badge-complete-bg:    #C6F6D5; --badge-complete-fg:    #22543D;

  /* Status Badges — Priority */
  --badge-high-bg:    #FED7D7; --badge-high-fg:    #742A2A;
  --badge-medium-bg:  #FEFCBF; --badge-medium-fg:  #744210;
  --badge-low-bg:     #C6F6D5; --badge-low-fg:     #22543D;

  /* Feedback */
  --color-success:  #38A169;
  --color-warning:  #D69E2E;
  --color-error:    #E53E3E;
  --color-info:     #3182CE;
}
```

All foreground/background pairs above are verified at ≥4.5:1 contrast ratio (WCAG AA for normal text).

### Typography

```css
:root {
  --font-family-base: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
                      Helvetica, Arial, sans-serif;
  --font-size-xs:   0.75rem;  /* 12px */
  --font-size-sm:   0.875rem; /* 14px */
  --font-size-base: 1rem;     /* 16px */
  --font-size-lg:   1.125rem; /* 18px */
  --font-size-xl:   1.25rem;  /* 20px */
  --font-size-2xl:  1.5rem;   /* 24px */
  --font-size-3xl:  1.875rem; /* 30px */

  --font-weight-normal:   400;
  --font-weight-medium:   500;
  --font-weight-semibold: 600;
  --font-weight-bold:     700;

  --line-height-tight:  1.25;
  --line-height-base:   1.5;
  --line-height-loose:  1.75;
}
```

### Spacing

```css
:root {
  --space-1:  0.25rem;  /* 4px */
  --space-2:  0.5rem;   /* 8px */
  --space-3:  0.75rem;  /* 12px */
  --space-4:  1rem;     /* 16px */
  --space-5:  1.25rem;  /* 20px */
  --space-6:  1.5rem;   /* 24px */
  --space-8:  2rem;     /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */
}
```

### Radii and Shadows

```css
:root {
  --radius-sm:   4px;
  --radius-base: 8px;
  --radius-lg:   12px;
  --radius-pill: 9999px;

  --shadow-sm:  0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.06);
  --shadow-md:  0 4px 6px rgba(0,0,0,.07), 0 2px 4px rgba(0,0,0,.06);
  --shadow-lg:  0 10px 15px rgba(0,0,0,.08), 0 4px 6px rgba(0,0,0,.05);
}
```

### Transitions

```css
:root {
  --transition-fast:   150ms ease;
  --transition-base:   200ms ease;
  --transition-slow:   300ms ease;
}
```

Used as: `transition: opacity var(--transition-base), transform var(--transition-base);`

All modal open/close, tab switch, and navigation animations use durations in the 100–300 ms range (Requirement 20.3).

---

## Form Validation Architecture

Validation is centralised in `validation.js` and applied by `FormValidator` in `components.js`.

### Field Validators (`validation.js`)

```js
export const validators = {
  required: (v) => v !== null && v !== undefined && String(v).trim() !== ''
               || 'This field is required.',

  maxLength: (n) => (v) => String(v).length <= n
               || `Must be ${n} characters or fewer.`,

  numeric: (v) => !isNaN(parseFloat(v)) && isFinite(v)
               || 'Must be a number.',

  range: (min, max) => (v) => {
    const n = parseFloat(v);
    return (n >= min && n <= max) || `Must be between ${min} and ${max}.`;
  },

  integerRange: (min, max) => (v) => {
    const n = Number(v);
    return (Number.isInteger(n) && n >= min && n <= max)
      || `Must be a whole number between ${min} and ${max}.`;
  },

  clientIdFormat: (v) => /^[A-Za-z0-9-]{1,50}$/.test(v)
               || 'Only letters, numbers, and hyphens allowed (max 50 chars).',

  uniqueClientId: (existingIds, currentId) => (v) =>
    v === currentId || !existingIds.includes(v)
               || 'A client with this ID already exists.',

  notPastDate: (v) => !v || v >= utils.today()
               || 'Date must be today or a future date.',

  notWhitespaceOnly: (v) => String(v).trim().length > 0
               || 'Must contain at least one non-whitespace character.',

  minLength: (n) => (v) => String(v).trim().length >= n
               || `Must be at least ${n} character(s).`,
};
```

### FormValidator Component

```js
// components.js — FormValidator
class FormValidator {
  constructor(formEl) { ... }

  // register(fieldName, [validator, ...])
  register(name, validators) { ... }

  // Returns { valid: bool, errors: { fieldName: errorMessage } }
  validate(formData) { ... }

  // Renders error messages adjacent to each field using:
  //   <span class="field-error" role="alert" aria-live="assertive">message</span>
  // and sets aria-invalid="true" on the input
  renderErrors(errors) { ... }

  clearErrors() { ... }
}
```

All validation errors are rendered inline, adjacent to the field, using `aria-live="assertive"` (Requirement 18.4). The form is not submitted until all validations pass.

---

## Export / Import JSON Schema

### Export File Structure

```json
{
  "version": "1",
  "exportedAt": "2025-01-15T14:30:00.000Z",
  "data": {
    "clients": [ /* Client[] */ ],
    "goals": [ /* Goal[] */ ],
    "habitAssignments": [ /* HabitAssignment[] */ ],
    "habitCompletions": [ /* HabitCompletion[] */ ],
    "checkIns": [ /* CheckIn[] */ ],
    "followUpNotes": [ /* FollowUpNote[] */ ],
    "settings": { /* Settings */ }
  }
}
```

### Export Implementation (`exportImport.js`)

```js
export function exportData(store) {
  const payload = {
    version: '1',
    exportedAt: new Date().toISOString(),
    data: {
      clients:          store.get('clients'),
      goals:            store.get('goals'),
      habitAssignments: store.get('habitAssignments'),
      habitCompletions: store.get('habitCompletions'),
      checkIns:         store.get('checkIns'),
      followUpNotes:    store.get('followUpNotes'),
      settings:         store.get('settings'),
    }
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `health-concierge-export-${utils.today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
```

### Import Implementation

```js
export async function importData(file, store) {
  let raw;
  try {
    raw = JSON.parse(await file.text());
  } catch (e) {
    throw new ImportError('malformed-json', 'The file contains invalid JSON syntax.');
  }

  const errs = validateImportSchema(raw); // checks version, data keys, entity shapes
  if (errs.length > 0) {
    throw new ImportError('missing-fields', errs.join('; '));
  }

  // Atomic replace: write all collections, then update in-memory
  const collections = ['clients','goals','habitAssignments',
                       'habitCompletions','checkIns','followUpNotes','settings'];
  collections.forEach(key => store.set(key, raw.data[key]));
}
```

### Round-Trip Guarantee (Requirement 16.5)

The export serialises every field of every entity. The import schema validator (`validateImportSchema`) checks:
- `version` field present
- `data` object present with all 7 keys
- Each entity array contains objects with all required fields and correct types

Because export writes exactly what is in memory, and import replaces exactly what is in the file, the property holds: for any valid export file, importing then exporting produces a file with identical entity types, record counts, and field values. The only field that differs is `exportedAt` (timestamp of the second export), which is metadata and not part of entity data.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| localStorage write fails | In-memory state kept; `Toast.show(warning)` with `aria-live="polite"` |
| localStorage unavailable at startup | Persistent banner in `app-root` before any module loads |
| Export fails (Blob/download API error) | `Toast.show(error)` with `aria-live="assertive"`; no partial file |
| Import — invalid JSON | Error message identifying "malformed JSON"; no store change |
| Import — valid JSON, missing fields | Error message identifying "missing required fields"; no store change |
| Module render throws | Error message in `app-root`; hash stays on current route |
| Screen load > 200 ms | `LoadingIndicator.show()` |
| Screen load > 5 s | Error message on current screen; no partial navigation |
| Form validation failure | Inline errors per field; `aria-live="assertive"`; form not submitted |
| Deletion of last reference list item | Inline error; item not removed |
| Deletion of referenced item (with records) | Warning with count + names; confirm proceeds, sets legacy label |

---

## Testing Strategy

### Unit Tests

Unit tests (Vitest) cover:
- `utils.js` date helpers (`getISOWeekRange`, `today`, `daysAgo`, `isWithinNext7Days`)
- `validation.js` all validators with valid/invalid inputs
- `db.js` each CRUD function against a mock store
- `exportImport.js` `validateImportSchema` for valid and malformed inputs
- Dashboard statistic calculations (isolated pure functions)
- Habit completion percentage calculation
- Note preview truncation logic

### Property-Based Tests

Property-based tests use [fast-check](https://github.com/dubzzz/fast-check) + [Vitest](https://vitest.dev/) to validate the 14 universal correctness properties defined in the Correctness Properties section.

- Minimum 100 iterations per property (`numRuns: 100`)
- Tag format: `// Feature: health-concierge-tracker, Property N: <property title>`
- Each Correctness Property maps to exactly one `fc.assert(fc.property(...))` test block

**Arbitrary (generator) strategy:**

| Entity | fast-check arbitrary |
|---|---|
| Client | `fc.record({ id: fc.uuid(), clientId: fc.stringMatching(/^[A-Za-z0-9-]{1,50}$/), fullName: fc.string({minLength:1, maxLength:100}), startWeight: fc.float({min:1, max:2000}), currentWeight: fc.float({min:1, max:2000}), ... })` |
| Goal | `fc.record({ id: fc.uuid(), clientId: fc.uuid(), description: fc.string({maxLength:200}), status: fc.constantFrom('Not Started','In Progress','Complete'), ... })` |
| CheckIn | `fc.record({ moodScore: fc.integer({min:1,max:10}), energyScore: fc.integer({min:1,max:10}), ... })` |
| Note text | `fc.string({minLength:1, maxLength:2000}).filter(s => s.trim().length > 0)` |
| Invalid weight | `fc.oneof(fc.float({max:0.99}), fc.float({min:2000.01, max:99999}))` |
| Whitespace-only string | `fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r'))` |
| App state | `fc.record({ clients: fc.array(clientArb), goals: fc.array(goalArb), ... })` |

### Accessibility Tests

Manual checks using:
- axe DevTools browser extension
- VoiceOver (macOS) + NVDA (Windows) for screen reader smoke tests
- Keyboard-only navigation walkthrough of every form and modal

Full WCAG 2.1 AA compliance cannot be automatically verified; manual assistive technology testing is required.

### Responsive Tests

Manual checks at:
- 768 px (minimum supported)
- 1024 px (upper tablet)
- 1280 px (standard desktop)
- 1920 px (wide desktop)

### Integration / Smoke Tests

- `localStorage` availability check on first load
- Mock data seed on first launch (all 5 entity types present)
- Chart.js renders without error when ≥ 2 check-ins exist

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: JSON Persistence Round-Trip

*For any* collection of valid records (Clients, Goals, HabitAssignments, HabitCompletions, CheckIns, FollowUpNotes), serialising the collection to JSON and then parsing the resulting string back produces an array of objects with identical entity types, field names, and field values.

**Validates: Requirements 3.1, 3.2**

---

### Property 2: Export–Import Round-Trip

*For any* valid application state, performing an export then an import then a second export produces a second export file whose `data` object (excluding the `exportedAt` timestamp) has identical entity types, record counts, and field values to the first export file's `data` object.

**Validates: Requirements 15.2, 16.5**

---

### Property 3: Invalid Import Isolation

*For any* input string that is either not valid JSON or is valid JSON but is missing one or more required top-level or entity-level fields, calling `importData` with that input SHALL throw an error and leave all store collections in their pre-import state unchanged.

**Validates: Requirements 16.4**

---

### Property 4: Dashboard Total Pounds Lost Is Never Negative

*For any* list of Active Client records with arbitrary start and current weights in the valid range [1.0, 2000.0], the computed `totalPoundsLost` value SHALL be greater than or equal to 0.0, and any individual client where `currentWeight >= startWeight` SHALL contribute exactly 0.0 to the total.

**Validates: Requirements 4.2, 4.8**

---

### Property 5: Habit Completion Percentage Is a Valid Percentage

*For any* habit assignment grid (any number of clients, any number of assigned habits, any completion pattern across a 7-day week), the computed completion percentage for each client SHALL be an integer in the range [0, 100] inclusive. When a client has zero habits assigned, the percentage SHALL be exactly 0.

**Validates: Requirements 11.5, 4.4**

---

### Property 6: Average Check-In Score Is In Range or Null

*For any* non-empty set of Check-In records belonging to Active clients within the last 7 calendar days, the computed average mood score and average energy score SHALL each be in the range [1.0, 10.0] inclusive. When the qualifying set is empty, both averages SHALL be null (displayed as "—").

**Validates: Requirements 4.5, 4.6, 4.7**

---

### Property 7: Goal completedDate Invariant

*For any* Goal record, the following two conditions SHALL always hold:
1. After a `setGoalStatus(goal, 'Complete')` operation, `goal.completedDate` SHALL equal today's ISO date and SHALL NOT be null.
2. After a `setGoalStatus(goal, status)` operation where `status` is any value other than `'Complete'`, `goal.completedDate` SHALL be null.

**Validates: Requirements 10.4, 10.5**

---

### Property 8: Client Search Filter Correctness

*For any* array of Client records and any non-empty search query string, every client returned by `filterClients(clients, query)` SHALL have a `fullName` field that contains the query string (case-insensitive), and every client whose `fullName` does NOT contain the query string (case-insensitive) SHALL NOT appear in the result.

**Validates: Requirements 7.2, 13.5**

---

### Property 9: Form Validation Rejects Invalid Values

*For any* weight value outside the range [1.0, 2000.0] or any Mood/Energy score that is not an integer in [1, 10], the corresponding form validator SHALL return a non-empty error message for that field and SHALL NOT return valid=true. Conversely, for any weight value in [1.0, 2000.0] and any integer score in [1, 10] (with all other required fields valid), the validator SHALL return valid=true.

**Validates: Requirements 8.4, 12.4**

---

### Property 10: Note Preview Truncation

*For any* string `s` and any positive integer limit `n`, the function `previewText(s, n)` SHALL return `s` unchanged if `s.length <= n`, and SHALL return `s.slice(0, n) + '…'` if `s.length > n`. The result SHALL never exceed `n + 1` characters in length.

**Validates: Requirements 6.2, 13.1**

---

### Property 11: Upcoming Appointments Filter and Order

*For any* array of Client records with arbitrary `nextAppointment` dates (including null), `getUpcomingAppointments(clients, today)` SHALL return only clients whose `nextAppointment` date falls in the inclusive range [today, today + 6 days], and the returned list SHALL be sorted in ascending order by `nextAppointment` date.

**Validates: Requirements 6.1**

---

### Property 12: Recent Follow-Ups Limit and Order

*For any* array of FollowUpNote records (of any length, including zero), `getRecentFollowUps(notes)` SHALL return at most 5 items, and the returned items SHALL be sorted in descending order by `createdAt`. When the input array has 5 or fewer items, all items SHALL be returned.

**Validates: Requirements 6.2**

---

### Property 13: Settings Reference List Validation

The following invariants SHALL hold for all reference list operations:
1. *For any* item name string of length 0 or length > 50 characters, `addReferenceItem` SHALL reject the item and return a validation error.
2. *For any* reference list containing an existing item `x`, attempting to add any string that equals `x` case-insensitively SHALL be rejected with a duplicate error.
3. *For any* reference list of length exactly 1, `deleteReferenceItem` SHALL reject the deletion and return an error stating at least one item must remain.

**Validates: Requirements 17.3, 17.4**

---

### Property 14: Sort Idempotence

*For any* array of records and any sortable column key, sorting the array by that key in ascending order twice in succession SHALL produce a result identical to sorting it once. Sorting in ascending order and then reversing the result SHALL produce the same array as sorting in descending order.

**Validates: Requirements 5.3, 7.1, 10.1, 12.1, 13.1**


