# Implementation Plan: Health Concierge Tracker

## Overview

Implement a fully client-side SPA using vanilla ES2020 modules, no bundler, hash-based routing, localStorage persistence, CSS design tokens, Chart.js 4.x for charts, and fast-check + Vitest for property-based testing. The app opens directly from `index.html` and ships with mock data pre-loaded on first launch.

---

## Tasks

- [x] 1. Project scaffold — HTML shell, CSS tokens, and static assets
  - Create `index.html` with the SPA shell: persistent `<nav>`, scope disclaimer `<aside role="note">`, `<main id="app-root">`, `<div id="modal-root">`, `<div id="loading-indicator">`, and both ARIA live regions (`role="status"` and `role="alert"`)
  - Add Chart.js 4.x CDN `<script>` tag and all local `<script type="module">` entry point
  - Create `styles/tokens.css` with all CSS custom properties: brand palette, neutral scale, semantic colors, status badge pairs, typography scale, spacing scale, radii, shadows, and transitions
  - Create `styles/base.css`: CSS reset, body defaults, typography scale classes
  - Create `styles/components.css`: buttons, badges, modals, tables, forms, toast, loading indicator
  - Create `styles/layout.css`: nav layout, `app-root` content area, responsive breakpoints (768 px / 1024 px / 1280 px / 1920 px)
  - All color pairs must meet WCAG 2.1 AA 4.5:1 contrast; all token names must match the design spec exactly
  - _Requirements: 1.1, 19.1, 19.2, 19.3, 20.1, 20.2, 20.4_

- [x] 2. Core utilities and validation layer
  - [x] 2.1 Create `js/utils.js`
    - Implement `today()` → ISO date string `YYYY-MM-DD`
    - Implement `daysAgo(n)` → ISO date string n calendar days before today
    - Implement `getISOWeekRange(date)` → `{ monday, sunday }` ISO date strings
    - Implement `isWithinNext7Days(dateStr, todayStr)` → boolean (inclusive range [today, today+6])
    - Implement `generateId()` → UUID v4 string
    - Implement `formatDate(isoStr)` → locale-friendly display string
    - _Requirements: 4.4, 4.5, 6.1, 11.1_

  - [ ]* 2.2 Write unit tests for `utils.js`
    - Test `today()` returns a valid ISO date
    - Test `daysAgo(0)` equals `today()`, `daysAgo(7)` is 7 days earlier
    - Test `getISOWeekRange` returns Monday–Sunday bounds for various input dates
    - Test `isWithinNext7Days` boundary conditions (today inclusive, today+6 inclusive, today+7 exclusive)
    - _Requirements: 4.4, 6.1_

  - [x] 2.3 Create `js/validation.js`
    - Implement all validators from the design spec: `required`, `maxLength`, `minLength`, `numeric`, `range`, `integerRange`, `clientIdFormat`, `uniqueClientId`, `notPastDate`, `notWhitespaceOnly`
    - Each validator returns `true` on success or a string error message on failure
    - _Requirements: 8.1, 8.2, 8.4, 12.4, 13.3, 17.3_

  - [ ]* 2.4 Write property test for form validation (Property 9)
    - **Property 9: Form Validation Rejects Invalid Values**
    - **Validates: Requirements 8.4, 12.4**
    - For any weight outside [1.0, 2000.0] the `range` validator must return a non-empty error string
    - For any non-integer or integer outside [1, 10] the `integerRange` validator must return a non-empty error string
    - For valid inputs, validators must return `true`

- [x] 3. Storage layer — `store.js` and `db.js`
  - [x] 3.1 Create `js/store.js`
    - Define in-memory `state` with keys: `clients`, `goals`, `habitAssignments`, `habitCompletions`, `checkIns`, `followUpNotes`, `settings`
    - Implement `store.load()` — reads all 8 `hc:*` keys from localStorage into state on startup; detects unavailable localStorage and emits a session-level error flag
    - Implement `store.get(key)` — returns a shallow copy of `state[key]`
    - Implement `store.set(key, value)` — sets `state[key]` and calls `persist(key, value)` within 300ms; on write failure keeps in-memory state and calls `announceStorageWarning()`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 3.2 Write property test for JSON persistence round-trip (Property 1)
    - **Property 1: JSON Persistence Round-Trip**
    - **Validates: Requirements 3.1, 3.2**
    - For any array of valid records, `JSON.parse(JSON.stringify(records))` must produce objects with identical field names and values

  - [x] 3.3 Create `js/db.js` — Client CRUD
    - Implement `db.getClients()`, `db.getClientById(id)`, `db.saveClient(data)` (create + update), `db.deleteClient(id)` (cascade deletes all Goals, HabitAssignments, HabitCompletions, CheckIns, FollowUpNotes for that client)
    - `saveClient` must enforce unique `clientId` across all records
    - _Requirements: 7.5, 8.5, 8.6, 8.7_

  - [x] 3.4 Create `js/db.js` — Goals, Habits, CheckIns, FollowUpNotes CRUD
    - Implement `db.getGoals()`, `db.saveGoal(data)`, `db.deleteGoal(id)` — `saveGoal` must auto-set `completedDate` when `status === 'Complete'` and clear it otherwise
    - Implement `db.getHabitAssignments()`, `db.saveHabitAssignment(data)`, `db.deleteHabitAssignment(id)`, `db.setHabitCompletion(habitAssignmentId, date, checked)`
    - Implement `db.getCheckIns()`, `db.saveCheckIn(data)`, `db.deleteCheckIn(id)`
    - Implement `db.getFollowUpNotes()`, `db.saveFollowUpNote(data)`, `db.deleteFollowUpNote(id)`
    - _Requirements: 10.4, 10.5, 11.4, 14.3, 14.7_

  - [ ]* 3.5 Write property test for goal `completedDate` invariant (Property 7)
    - **Property 7: Goal completedDate Invariant**
    - **Validates: Requirements 10.4, 10.5**
    - After `db.saveGoal` with `status = 'Complete'`, `completedDate` must equal today's ISO date and be non-null
    - After `db.saveGoal` with any other status, `completedDate` must be null

  - [x] 3.6 Create `js/db.js` — Settings CRUD and reference data management
    - Implement `db.getSettings()`, `db.saveSettings(data)`
    - Implement `db.addReferenceItem(listKey, value)` — validates 1–50 chars, no case-insensitive duplicate; returns error on failure
    - Implement `db.deleteReferenceItem(listKey, value)` — prevents deletion of last item; warns on in-use items; on confirmed deletion replaces value in all referencing records with `value + ' (removed)'`
    - _Requirements: 17.3, 17.4, 17.5, 17.6_

  - [ ]* 3.7 Write property test for settings reference list validation (Property 13)
    - **Property 13: Settings Reference List Validation**
    - **Validates: Requirements 17.3, 17.4**
    - For any item name with length 0 or > 50 chars, `addReferenceItem` must reject and return an error
    - For any list containing item `x`, adding any string equal to `x` (case-insensitive) must be rejected
    - For any list of length exactly 1, `deleteReferenceItem` must reject and return an error

- [x] 4. Mock data seed and first-launch initialization
  - Create `js/mockData.js` with at least one complete record of each type: Client, Goal, HabitAssignment, HabitCompletion, CheckIn, FollowUpNote, and all default Settings lists (7 habits, 5 support styles, 3 priority levels, 3 client statuses, 3 goal statuses)
  - Create `js/main.js` bootstrap logic: call `store.load()`; if `hc:initialized` is absent, seed mock data and set `hc:initialized = "true"`; detect localStorage unavailability and show persistent session banner; then init router
  - _Requirements: 3.6, 17.2_

- [ ] 5. Router and navigation
  - [x] 5.1 Create `js/router.js`
    - Implement hash-based router with the full route table: `#/`, `#/dashboard`, `#/clients`, `#/clients/:id`, `#/goals`, `#/habits`, `#/mood`, `#/follow-ups`, `#/settings`
    - Listen on `hashchange` and `load` events; call `matchRoute` and delegate to the correct module's `render()` function
    - Wrap `module.render()` in try/catch; on error show error message in `app-root` and keep hash unchanged
    - Integrate `LoadingIndicator.showAfter(200)` / `LoadingIndicator.hide()` around renders; on render taking > 5 seconds show error on current screen
    - _Requirements: 2.2, 2.4_

  - [x] 5.2 Create `js/modules/nav.js`
    - Render the `<nav>` with all 7 top-level items in the specified order
    - Implement `nav.setActive(routeName)` — updates active item with two distinguishing visual properties (`background-color` change + `font-weight: 700`)
    - Render the scope disclaimer `<aside role="note">` below the nav; disclaimer must include all four required elements (no diagnosis, no treatment/prescribing, medical decisions belong to licensed provider, not a replacement)
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.3_

- [x] 6. Shared UI components (`js/components.js`)
  - [x] 6.1 Implement `Modal` and `ConfirmDialog`
    - `Modal.open(title, bodyHTML, {onConfirm, onCancel})` — renders into `#modal-root`, applies `position: fixed`, focus trap (Tab/Shift+Tab stays within dialog), ESC closes, `aria-modal="true"`, `role="dialog"`
    - `ConfirmDialog.open(message)` → returns `Promise<boolean>` — wraps Modal with Confirm/Cancel buttons
    - Apply CSS transition 100–300ms for open/close phases
    - _Requirements: 7.5, 14.6, 18.5, 20.3_

  - [x] 6.2 Implement `Toast`, `LoadingIndicator`, `StatusBadge`
    - `Toast.show(message, type)` — appends to `role="status"` live region, auto-dismisses after 4s, does not trap focus, supports types: success/warning/error/info
    - `LoadingIndicator.show()` / `LoadingIndicator.hide()` — shows/hides `#loading-indicator`; `LoadingIndicator.showAfter(ms)` delays show by given ms
    - `StatusBadge.render(text, category)` — returns HTML string for a pill badge using design token colors for Client Status, Goal Status, and Priority Level categories
    - _Requirements: 2.4, 3.4, 18.4, 18.6, 20.2_

  - [x] 6.3 Implement `SortableTable`
    - `new SortableTable(container, columns, data)` constructor
    - Column header click sorts ascending; second click on same header sorts descending; renders sort direction indicator
    - Emits or calls a `onRowClick` callback with the row's record
    - Handles empty-state message when data array is empty
    - Touch targets on headers ≥ 44×44 CSS px; responsive: applies horizontal scroll on narrow viewports
    - _Requirements: 5.3, 7.1, 19.2, 19.4_

  - [ ]* 6.4 Write property test for sort idempotence (Property 14)
    - **Property 14: Sort Idempotence**
    - **Validates: Requirements 5.3, 7.1, 10.1, 12.1, 13.1**
    - For any array of records and any column key, sorting twice ascending must equal sorting once
    - Sorting ascending then reversing must equal sorting descending

  - [x] 6.5 Implement `FormValidator`
    - `new FormValidator(formEl)` constructor
    - `register(name, [validators])` — registers field validation rules
    - `validate(formData)` → `{ valid, errors }` object
    - `renderErrors(errors)` — renders `<span class="field-error" role="alert" aria-live="assertive">` adjacent to each field; sets `aria-invalid="true"` on affected inputs
    - `clearErrors()` — removes all error spans and resets `aria-invalid`
    - _Requirements: 8.2, 8.3, 8.4, 18.3, 18.4_

- [x] 7. Checkpoint — core infrastructure complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Export / Import module (`js/exportImport.js`)
  - [x] 8.1 Implement `exportData(store)`
    - Build the JSON payload with `version: "1"`, `exportedAt` ISO timestamp, and all 7 data collections from `store.get()`
    - Create a `Blob`, generate an object URL, trigger download with filename `health-concierge-export-YYYY-MM-DD.json` using `utils.today()`
    - Call `Toast.show(success)` on successful download initiation; call `Toast.show(error, 'error')` on Blob/download failure with no partial file
    - Handle empty-dataset case (still exports valid JSON)
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

  - [x] 8.2 Implement `importData(file, store)` and `validateImportSchema(raw)`
    - Parse file text as JSON; throw `ImportError('malformed-json', ...)` on parse failure
    - `validateImportSchema(raw)` — check `version` field, `data` object with all 7 required keys, and entity array shapes; throw `ImportError('missing-fields', errs.join('; '))` on failure
    - On successful validation: atomically replace all 7 store collections then refresh all in-memory state
    - On any validation or parse error: leave all store collections unchanged
    - _Requirements: 16.1, 16.3, 16.4, 16.6_

  - [ ]* 8.3 Write property test for export–import round-trip (Property 2)
    - **Property 2: Export–Import Round-Trip**
    - **Validates: Requirements 15.2, 16.5**
    - For any valid app state: serialize to export JSON, parse as import, serialize again — second `data` object (excluding `exportedAt`) must equal the first exactly

  - [ ]* 8.4 Write property test for invalid import isolation (Property 3)
    - **Property 3: Invalid Import Isolation**
    - **Validates: Requirements 16.4**
    - For any string that is not valid JSON or is valid JSON missing required fields, `importData` must throw and leave all store collections unchanged

- [x] 9. Dashboard module (`js/modules/dashboard.js`)
  - [x] 9.1 Implement dashboard statistics computation
    - Compute active client count, total pounds lost (negative contributions clamped to 0), goals completed X of Y, average habit completion for current ISO week, average mood and energy scores for last 7 days (null / "—" when no qualifying check-ins)
    - All statistics computed fresh from `store.get()` on every render with no caching between renders
    - Handle all-zero / no-client edge cases as specified in Requirement 4.8
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ]* 9.2 Write property test for total pounds lost non-negativity (Property 4)
    - **Property 4: Dashboard Total Pounds Lost Is Never Negative**
    - **Validates: Requirements 4.2**
    - For any list of Active Clients with weights in [1.0, 2000.0]: `totalPoundsLost >= 0`
    - For any individual client where `currentWeight >= startWeight`: contribution is exactly 0.0

  - [ ]* 9.3 Write property test for average check-in score range (Property 6)
    - **Property 6: Average Check-In Score Is In Range or Null**
    - **Validates: Requirements 4.5, 4.6, 4.7**
    - For any non-empty set of qualifying check-ins: avg mood and avg energy are each in [1.0, 10.0]
    - For empty qualifying set: both return null

  - [ ]* 9.4 Write property test for habit completion percentage validity (Property 5)
    - **Property 5: Habit Completion Percentage Is a Valid Percentage**
    - **Validates: Requirements 11.5, 4.4**
    - For any habit assignment grid: per-client completion % is an integer in [0, 100]
    - For a client with zero habits: completion % is exactly 0

  - [x] 9.5 Implement dashboard upcoming appointments and recent follow-ups
    - `getUpcomingAppointments(clients, today)` — returns clients with `nextAppointment` in [today, today+6] sorted ascending by date; show "no upcoming appointments" message when empty
    - `getRecentFollowUps(notes)` — returns top 5 most recent notes sorted descending by `createdAt`; each entry shows Client Name, note date, and note preview truncated to 80 chars + "…"
    - Show "no recent follow-ups" message when empty
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 9.6 Write property test for upcoming appointments filter and order (Property 11)
    - **Property 11: Upcoming Appointments Filter and Order**
    - **Validates: Requirements 6.1**
    - For any array of Clients: `getUpcomingAppointments` returns only clients with `nextAppointment` in [today, today+6]
    - Returned list is sorted ascending by `nextAppointment`

  - [ ]* 9.7 Write property test for recent follow-ups limit and order (Property 12)
    - **Property 12: Recent Follow-Ups Limit and Order**
    - **Validates: Requirements 6.2**
    - For any array of FollowUpNotes: `getRecentFollowUps` returns at most 5 items sorted descending by `createdAt`
    - When input has ≤ 5 items, all are returned

  - [x] 9.8 Implement dashboard render — stats strip and client roster table
    - Render 6 metric cards in the stats strip
    - Render client roster table using `SortableTable` (default sort: ascending by Name)
    - Implement status filter select defaulting to "All"; filter client rows by selected status
    - Row click navigates to `#/clients/:id`
    - Display "no clients" message when roster is empty
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 10. Clients module (`js/modules/clients.js`)
  - [x] 10.1 Implement clients roster screen
    - Render sortable table (Name, Client ID, Priority, Status, Next Appointment, Actions) with default ascending sort by Name; show "no clients" message when empty; show "no matches" message when search produces no results
    - Search input filters `fullName` case-insensitively debounced to 300ms
    - Actions column: View (navigate to `#/clients/:id`), Edit (open client form modal pre-populated), Delete (open `ConfirmDialog` then `db.deleteClient`)
    - "Add Client" button opens client form modal for new record
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ]* 10.2 Write property test for client search filter correctness (Property 8)
    - **Property 8: Client Search Filter Correctness**
    - **Validates: Requirements 7.2, 13.5**
    - For any array of Clients and any non-empty query: every returned client's `fullName` contains the query (case-insensitive)
    - Every client whose `fullName` does NOT contain the query must not appear in results

  - [x] 10.3 Implement client add/edit form
    - Form fields per Requirement 8.1: Full Name, Client ID, Start Weight, Current Weight, Next Appointment, Priority Level, Client Status, Support Style
    - Wire `FormValidator` with all required validators; display inline errors adjacent to each field with `aria-invalid` and `aria-live="assertive"`; required fields marked with visible indicator + `aria-required="true"`
    - On valid submit: `db.saveClient(data)` → `Toast.show(success)` → close modal and re-render roster
    - On save failure: `Toast.show(error, 'error')`, stay on form
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 18.3, 18.4_

- [x] 11. Client Profile module (`js/modules/clientProfile.js`)
  - [x] 11.1 Implement profile shell — header and tab strip
    - Persistent header: client name, `clientId`, Priority badge (`StatusBadge`), Status badge
    - Render scope disclaimer banner in this view
    - Tab strip with 5 tabs in order: Intake, Goals, Habits, Mood & Energy, Follow-Up Notes; default to Intake tab; persist selected tab in `sessionStorage` keyed by `client.id`; arrow-key navigation between tabs
    - Tab content renders within 300ms of tab selection
    - _Requirements: 1.3, 9.1, 9.2, 9.3, 9.4, 18.1_

  - [x] 11.2 Implement Intake tab (read-only + edit mode)
    - Read-only view displays all Requirement 8.1 fields with "Edit" button
    - "Edit" switches to edit mode with all fields pre-populated using the same client form component (client locked on edit)
    - Save → update via `db.saveClient`, switch back to read-only with updated values, show Toast success
    - Cancel → discard changes, return to read-only
    - _Requirements: 9.5_

- [x] 12. Goals module (`js/modules/goals.js`)
  - [x] 12.1 Implement global goals screen
    - Render sortable table: Client Name, Goal Description, Why It Matters, Target Date, Goal Status, Completed Date; status filter dropdown defaulting to "All"
    - "Add Goal" button opens goal form modal
    - Edit/Delete actions per row; Delete uses `ConfirmDialog`
    - _Requirements: 10.1, 10.2, 10.7, 10.8_

  - [x] 12.2 Implement goal add/edit form
    - Fields: Client dropdown (required), Goal Description (required, max 200 chars), Why It Matters (optional, max 500 chars), Target Date (date picker), Goal Status (required)
    - `db.saveGoal` handles `completedDate` auto-set/clear
    - Inline validation errors; `aria-required` on required fields
    - _Requirements: 10.3, 10.4, 10.5, 10.9_

  - [x] 12.3 Wire Goals tab in Client Profile (profile view)
    - Re-use goals module render with `clientId` filter applied; Client field pre-populated and locked to the current client
    - _Requirements: 10.6_

- [x] 13. Habits module (`js/modules/habits.js`)
  - [x] 13.1 Implement weekly habits grid
    - Week picker `<input type="date">` drives `getISOWeekRange(date)` → display Monday–Sunday range
    - Previous Week / Next Week controls shift by 7 days
    - Grid: one row per (client × habitAssignment); 7 checkbox columns (Mon–Sun); per-client completion % column
    - Checkbox `change` → `db.setHabitCompletion(habitAssignmentId, date, checked)` within 300ms
    - Show "no habits assigned" message when a client has zero habits; message prompts to configure via Settings
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.8_

  - [x] 13.2 Wire Habits tab in Client Profile (profile view)
    - Filter grid to the specific client's assignments and completions only
    - _Requirements: 11.7_

- [x] 14. Mood & Energy module (`js/modules/moodEnergy.js`)
  - [x] 14.1 Implement check-in log and add/edit form
    - Render sortable table: Client Name, Date, Mood Score, Energy Score, Notes; default sort date descending
    - "Add Check-In" button opens form modal; fields: Client (Active clients only), Date (today default), Mood Score (integer 1–10), Energy Score (integer 1–10), Notes (optional, max 500 chars)
    - Inline validation; `integerRange(1, 10)` validator on scores; success Toast on save
    - Edit/Delete actions; Delete uses `ConfirmDialog`
    - Multiple check-ins on same client+date are permitted
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.8, 12.9, 14.1, 14.5_

  - [x] 14.2 Implement mood/energy trend chart
    - Client filter select; when a client is selected and has ≥ 2 check-ins, render Chart.js 4.x line chart: Date on X-axis (chronological), Score 1–10 on Y-axis, two datasets (Mood Score, Energy Score), legend enabled
    - Canvas element must have descriptive `aria-label`
    - When < 2 check-ins exist for selected client, show "insufficient data" message instead of chart
    - _Requirements: 12.6, 12.7_

  - [x] 14.3 Wire Mood & Energy tab in Client Profile (profile view)
    - Filter log and chart to the specific client; Client field pre-populated and locked
    - _Requirements: 12.5_

- [x] 15. Follow-Ups module (`js/modules/followUps.js`)
  - [x] 15.1 Implement follow-ups log and add/edit form
    - Render table: Client Name, Date, Note Preview (first 100 chars + "…" if longer)
    - "Add Note" button opens form modal; fields: Client (required), Date (today default), Note Text (required, min 1 non-whitespace char, max 2000 chars)
    - Inline validation including `notWhitespaceOnly`; Edit/Delete actions; Delete uses `ConfirmDialog`
    - Search input filters on Client Name + Note Text case-insensitively, debounced 300ms; "no matches" message when empty
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 14.1_

  - [ ]* 15.2 Write property test for note preview truncation (Property 10)
    - **Property 10: Note Preview Truncation**
    - **Validates: Requirements 6.2, 13.1**
    - For any string `s` and limit `n`: `previewText(s, n)` returns `s` unchanged when `s.length <= n`; returns `s.slice(0, n) + '…'` when `s.length > n`; result never exceeds `n + 1` characters

  - [x] 15.3 Wire Follow-Up Notes tab in Client Profile (profile view)
    - Filter notes to the specific client; Client field pre-populated and locked
    - _Requirements: 13.6_

- [x] 16. Settings module (`js/modules/settings.js`)
  - Render five editable reference lists: Common Habits, Support Styles, Priority Levels, Client Status Values, Goal Status Values
  - Each list: `<ul>` with inline delete buttons + "Add item" text input + button; validate 1–50 chars, no case-insensitive duplicate; show inline error on failure
  - Delete: warn when item is in use (count + record names); prevent deletion of last item with inline error; on confirmed deletion call `db.deleteReferenceItem` which applies legacy label
  - Render Export button (calls `exportData`) and Import section (file input → `importData` with `ConfirmDialog` warning before overwrite)
  - Display import/export success and error toasts
  - _Requirements: 15.1, 16.1, 16.2, 16.3, 17.1, 17.2, 17.3, 17.4, 17.5, 17.6_

- [x] 17. Accessibility pass — ARIA, keyboard navigation, focus management
  - Audit all forms: every input has a visible `<label>` with `for`/`id` pairing or `aria-labelledby`; required fields have `aria-required="true"` and a visible indicator
  - Audit all interactive elements for keyboard operability: buttons/links activated with Enter; checkboxes toggled with Space; tab panels navigated with arrow keys; all elements in Tab/Shift+Tab order
  - Verify visible focus rings ≥ 2px on all interactive elements meeting WCAG AA contrast
  - Verify all dynamic content updates use correct live region types (`polite` for success/info, `assertive` for errors/destructive confirmations); announcements appear within 1 second
  - Verify modal focus trap (Tab/Shift+Tab contained within dialog); verify Toast does not trap focus
  - Add SVG `<title>` and `aria-hidden="true"` to all inline SVG icons
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_

- [x] 18. Responsive layout and touch-target pass
  - Apply `overflow-x: auto` to all data tables so they scroll horizontally between 768 px and 1024 px without clipping; verify full-column layout at 1025 px+
  - Ensure all buttons, checkboxes, form inputs, and nav items have minimum 44×44 CSS px touch targets
  - Test no horizontal scrollbar appears on content (non-table) elements at 768 px
  - _Requirements: 19.1, 19.2, 19.3, 19.4_

- [x] 19. Final integration and wiring
  - [x] 19.1 Wire all modules into `js/main.js` and router
    - Import all module render functions; register all routes; ensure `nav.setActive` is called on every navigation; ensure each module's `render()` is called fresh when its route activates
    - Verify dashboard stats update correctly after creating/editing records in other modules (router re-render on activation)
    - _Requirements: 2.1, 2.2, 2.3, 4.1–4.8_

  - [x] 19.2 Implement CSS transitions for tab switch, modal open/close, and navigation changes
    - All animated elements use transition durations 100–300ms for both enter and exit phases
    - Use `--transition-fast`, `--transition-base`, `--transition-slow` tokens exclusively
    - _Requirements: 20.3_

  - [ ]* 19.3 Write integration smoke tests
    - localStorage availability check on first load
    - Mock data seed produces at least one record of each of the 5 entity types
    - Chart.js renders without error when ≥ 2 check-ins exist for a selected client
    - Export produces valid JSON; import of that JSON produces identical record counts
    - _Requirements: 3.6, 12.7, 15.2, 16.5_

- [x] 20. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints at tasks 7 and 20 provide incremental validation gates
- Property tests (Properties 1–14) validate universal correctness guarantees using fast-check + Vitest; each is a separate optional sub-task close to its implementation
- Unit tests cover `utils.js`, `validation.js`, `db.js`, `exportImport.js` helpers, and statistic calculation functions
- `store.js` and `db.js` are separate files: `store.js` owns in-memory state and localStorage I/O; `db.js` owns all business-logic CRUD operations
- All form submissions are gated by `FormValidator`; no direct localStorage writes from module files
- The SPA works from `file://` because of hash-based routing — no server or build step required
- Chart.js is the only CDN dependency; all other code is local ES2020 modules

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "2.3"] },
    { "id": 1, "tasks": ["2.2", "2.4", "3.1"] },
    { "id": 2, "tasks": ["3.2", "3.3"] },
    { "id": 3, "tasks": ["3.4", "3.6"] },
    { "id": 4, "tasks": ["3.5", "3.7"] },
    { "id": 5, "tasks": ["5.1", "5.2", "6.1", "6.2", "6.3", "6.5"] },
    { "id": 6, "tasks": ["6.4", "8.1"] },
    { "id": 7, "tasks": ["8.2", "9.1", "9.5"] },
    { "id": 8, "tasks": ["8.3", "8.4", "9.2", "9.3", "9.4", "9.6", "9.7", "9.8"] },
    { "id": 9, "tasks": ["10.1", "10.3", "11.1", "12.1", "13.1", "14.1", "15.1"] },
    { "id": 10, "tasks": ["10.2", "11.2", "12.2", "12.3", "13.2", "14.2", "14.3", "15.2", "15.3"] },
    { "id": 11, "tasks": ["19.1", "19.2"] },
    { "id": 12, "tasks": ["19.3"] }
  ]
}
```
