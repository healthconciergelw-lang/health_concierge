# Requirements Document

## Introduction

Health Concierge is a client-side web application for concierge health coaches who act as non-medical client liaisons. The application provides a structured, professional tool for managing client wellness journeys — tracking goals, habits, mood, energy, and coaching notes — without performing any medical diagnosis, treatment, prescribing, or clinical decision-making. All medical decisions remain between the client and their licensed healthcare provider.

The application runs entirely in the browser with no backend server. Data is persisted using browser-local storage (localStorage/IndexedDB). The system supports a single coach/practitioner and their full client roster. The UI must be stable, premium, and intuitive, suitable for use in a professional health coaching practice.

---

## Glossary

- **Application**: The Health Concierge web application.
- **Coach**: The concierge health coach who is the sole user of the Application.
- **Client**: An individual enrolled with the Coach for non-medical wellness support.
- **Client Profile**: The aggregate record for a single Client, containing intake data and all associated tracking records.
- **Dashboard**: The home screen presenting summary statistics and at-a-glance views of the full client roster.
- **Goal**: A single wellness objective defined for a specific Client.
- **Habit**: A recurring daily wellness behavior tracked on a weekly basis for a Client.
- **Check-In**: A daily mood and energy log entry recorded for a Client.
- **Follow-Up Note**: A free-text coaching note recorded for a specific Client at a specific date and time.
- **Priority Level**: A Coach-assigned classification of a Client's urgency: High, Medium, or Low.
- **Client Status**: The current enrollment state of a Client: Active, Inactive, or Graduated.
- **Goal Status**: The completion state of a Goal: Not Started, In Progress, or Complete.
- **Support Style**: The frequency or mode of coaching contact assigned to a Client.
- **Common Habit**: A pre-defined habit option available in the Application's Settings for use in the Habit Tracker.
- **Local Storage**: Browser-based persistence mechanism (localStorage or IndexedDB) used to retain all Application data on the Coach's device.
- **Mock Data**: Pre-populated sample records used to demonstrate Application functionality; these do not represent real individuals.
- **Current Week**: Monday 00:00:00 through Sunday 23:59:59 of the calendar week containing the current date (ISO week boundary).

---

## Requirements

### Requirement 1: Application Identity and Scope Disclaimer

**User Story:** As a Coach, I want the application to be clearly branded as "Health Concierge" and to display a scope disclaimer, so that clients and observers understand this tool is non-medical.

#### Acceptance Criteria

1. THE Application SHALL display the name "Health Concierge" in the top-most persistent navigation bar that remains visible across all screens, without requiring any user interaction to reveal it.
2. THE Application SHALL permanently display a non-medical scope disclaimer — visible without requiring any user interaction — that includes all four of the following elements: (a) the tool does not provide diagnosis; (b) the tool does not provide treatment or prescribing; (c) all medical decisions remain between the client and their licensed healthcare provider; (d) the tool is not a replacement for licensed healthcare providers.
3. THE Application SHALL display the scope disclaimer on the Dashboard, and on all Client Profile screens including the profile view, profile edit mode, and all profile tab sub-screens (Intake, Goals, Habits, Mood & Energy, Follow-Up Notes).

---

### Requirement 2: Navigation and Module Structure

**User Story:** As a Coach, I want a clear, persistent navigation menu, so that I can move between modules without losing my place or context.

#### Acceptance Criteria

1. THE Application SHALL provide a persistent navigation menu accessible from every screen containing the following top-level items in order: Dashboard, Clients, Goals, Habits, Mood & Energy, Follow-Ups, Settings.
2. WHEN the Coach selects a navigation item and the target module screen fails to load within 5 seconds, THE Application SHALL display an error message on the current screen and keep the Coach on the current screen without partial navigation.
3. THE Application SHALL visually indicate the currently active navigation item using at least two distinguishing visual properties (e.g., background color change plus font weight change) that differ from all inactive items.
4. WHILE a screen is loading data from Local Storage and the load operation has not completed within 200ms, THE Application SHALL display a loading indicator until the data is fully rendered.

---

### Requirement 3: Data Persistence via Local Storage

**User Story:** As a Coach, I want all data I enter to be saved automatically in my browser, so that I can close and reopen the application without losing records.

#### Acceptance Criteria

1. THE Application SHALL persist all Client, Goal, Habit, Check-In, and Follow-Up Note records using the browser's Local Storage mechanism.
2. WHEN the Application is opened after being closed, THE Application SHALL restore all previously saved records from Local Storage such that every Client, Goal, Habit, Check-In, and Follow-Up Note record present at the time of closure is present and readable after reload with all its fields intact.
3. WHEN a record is created, updated, or deleted, THE Application SHALL update Local Storage within 300ms of the operation completing.
4. IF a Local Storage write fails for any reason — including storage quota exhaustion, write access denial, or Local Storage being unavailable — THEN THE Application SHALL allow the in-memory record change to remain and display a warning message indicating that the change has not been persisted and will be lost on reload.
5. IF Local Storage is unavailable or write access is denied before any records are loaded, THEN THE Application SHALL display an error message informing the Coach that data cannot be saved and will not persist for the current session.
6. THE Application SHALL ship with pre-populated Mock Data containing at least one record of each type — Client, Goal, Habit, Check-In, and Follow-Up Note — so the Coach can interact with all five record types without entering real data.

---

### Requirement 4: Dashboard — Summary Statistics

**User Story:** As a Coach, I want a dashboard showing key aggregate metrics across all active clients, so that I can assess the overall health of my practice at a glance.

#### Acceptance Criteria

1. THE Dashboard SHALL display the count of Clients whose Client Status is Active.
2. THE Dashboard SHALL display the total pounds lost across all Active Clients, calculated as the sum of (Start Weight − Current Weight) for each Active Client where Start Weight is greater than Current Weight, rounded to one decimal place; Active Clients where Current Weight is greater than or equal to Start Weight SHALL contribute 0 to the total.
3. THE Dashboard SHALL display the count of Goals with Goal Status equal to Complete, and the total count of all Goals, formatted as "X of Y".
4. THE Dashboard SHALL display the average Habit completion percentage across all Active Clients for the Current Week — defined as Monday 00:00:00 through Sunday 23:59:59 of the calendar week containing today — rounded to the nearest whole number; WHEN no Active Clients have any habits assigned for the Current Week, THE Dashboard SHALL display 0%.
5. THE Dashboard SHALL display the average Mood Score across all Check-Ins recorded in the last 7 calendar days for Active Clients who have at least one Check-In in that window, rounded to one decimal place.
6. THE Dashboard SHALL display the average Energy Score across all Check-Ins recorded in the last 7 calendar days for Active Clients who have at least one Check-In in that window, rounded to one decimal place.
7. WHEN no Active Clients have any Check-In records within the last 7 calendar days, THE Dashboard SHALL display "—" in place of the average Mood and Energy scores.
8. WHEN no Active Clients exist, THE Dashboard SHALL display "0" for the Active Clients count, "0.0" for Total Pounds Lost, "0 of 0" for Goals Completed, "0%" for Avg Habit Completion, and "—" for Avg Mood Score and Avg Energy Score.

---

### Requirement 5: Dashboard — Client Roster Table

**User Story:** As a Coach, I want to see a sortable client roster table on the dashboard, so that I can quickly scan all clients and open a profile with a single click.

#### Acceptance Criteria

1. THE Dashboard SHALL display a Client Roster table containing one row per Client with the following columns: Name, Client ID, Start Weight, Current Weight, Pounds Lost, Latest Mood Score, Latest Energy Score, Next Appointment, Priority Level, Client Status; WHEN a Client has no Check-In records, THE Application SHALL display "—" in the Latest Mood Score and Latest Energy Score cells; WHEN a Client's Current Weight is greater than or equal to Start Weight, THE Application SHALL display "0" in the Pounds Lost cell.
2. WHEN the Coach clicks a row in the Client Roster table, THE Application SHALL navigate to the selected Client's profile screen.
3. WHEN the Coach clicks a column header in the Client Roster table, THE Application SHALL sort the table by that column in ascending order; WHEN the Coach clicks the same column header again, THE Application SHALL toggle to descending order; THE default sort order SHALL be ascending alphabetical by Client Name.
4. THE Dashboard Client Roster table SHALL display all Clients regardless of Client Status by default.
5. THE Dashboard SHALL provide a single-select filter control defaulting to "All" that, when the Coach selects a specific Client Status value, restricts the table to display only Clients with that Client Status.
6. WHEN the Client Roster table contains no records, THE Application SHALL display a message within the table area stating that no clients have been added yet.

---

### Requirement 6: Dashboard — Upcoming Appointments and Recent Follow-Ups

**User Story:** As a Coach, I want to see upcoming appointments and recent follow-up notes on the dashboard, so that I can prepare for the day without navigating away.

#### Acceptance Criteria

1. THE Dashboard SHALL display an Upcoming Appointments section listing all Clients whose Next Appointment date falls within the next 7 calendar days starting from and including today (i.e., today through today + 6 days inclusive), sorted by Next Appointment date ascending; WHEN no Client has a Next Appointment date within that window, THE Dashboard SHALL display a message within the section stating there are no upcoming appointments.
2. THE Dashboard SHALL display a Recent Follow-Ups section showing at most the 5 most recently created Follow-Up Notes across all Clients, sorted by creation date descending, including the Client Name, note date, and a preview of the first 80 characters of note text followed by "…" if the note exceeds 80 characters.
3. IF no Follow-Up Notes exist, THE Dashboard SHALL display a message within the Recent Follow-Ups section stating there are no recent follow-ups.

---

### Requirement 7: Client Management — Roster Screen

**User Story:** As a Coach, I want a dedicated Clients screen where I can view, add, and manage all clients, so that I have a complete roster view independent of the dashboard.

#### Acceptance Criteria

1. THE Clients screen SHALL display all Clients in a sortable table with columns: Name, Client ID, Priority Level, Client Status, Next Appointment, and an Actions column; THE default sort order SHALL be ascending alphabetical by Client Name.
2. WHEN the Coach types in the search input on the Clients screen, THE Application SHALL filter the table to show only Clients whose Full Name contains the typed string (case-insensitive), with results updating within 300ms of each keystroke.
3. THE Clients screen SHALL provide an "Add Client" button that opens a form to create a new Client record.
4. THE Clients screen Actions column SHALL provide buttons or links to View (open profile), Edit, and Delete each Client.
5. WHEN the Coach selects Delete for a Client, THE Application SHALL display a confirmation dialog, and SHALL permanently remove the Client record and all associated Goals, Habits, Check-Ins, and Follow-Up Notes from Local Storage only after the Coach confirms the deletion in the dialog.
6. WHEN the search input produces no matching Clients, THE Application SHALL display a message within the table area stating no clients match the search.
7. WHEN no Client records exist, THE Application SHALL display a message within the table area prompting the Coach to add their first client.

---

### Requirement 8: Client Management — Add and Edit Client

**User Story:** As a Coach, I want to add and edit client records with all relevant intake fields, so that each client's profile contains complete, accurate information.

#### Acceptance Criteria

1. THE Client form SHALL include the following fields: Full Name (required, maximum 100 characters), Client ID (required, unique, alphanumeric and hyphens only, maximum 50 characters), Start Weight in pounds (required, numeric, between 1.0 and 2000.0 inclusive), Current Weight in pounds (required, numeric, between 1.0 and 2000.0 inclusive), Next Appointment date (must not be a past date), Priority Level (selection from: High, Medium, Low), Client Status (selection from: Active, Inactive, Graduated), and Support Style (selection from the list defined in Settings).
2. WHEN the Coach submits a Client form with a missing required field, THE Application SHALL display an inline validation message adjacent to each missing field and SHALL NOT save the record.
3. WHEN the Coach submits a Client form with a Client ID that already exists for a different Client, THE Application SHALL display a validation message stating the Client ID must be unique and SHALL NOT save the record.
4. WHEN the Coach submits a Client form with a weight value that is non-numeric or outside the range 1.0–2000.0 lbs, THE Application SHALL display an inline validation message on the affected weight field and SHALL NOT save the record.
5. WHEN the Coach submits a valid new Client form, THE Application SHALL save the Client record to Local Storage and display the new Client as an entry in the client roster list.
6. WHEN the Coach submits a valid edited Client form, THE Application SHALL update the existing Client record in Local Storage and display a success confirmation message.
7. IF a Local Storage write fails when saving a Client record, THEN THE Application SHALL display an error message stating the record could not be saved and SHALL NOT navigate away from the form.

---

### Requirement 9: Client Profile — Tabbed Layout

**User Story:** As a Coach, I want a client profile screen with tabbed sections, so that all tracking data for a single client is organized and accessible without scrolling through unrelated information.

#### Acceptance Criteria

1. THE Client Profile screen SHALL display the Client's name, Client ID, Priority Level, and Client Status in a persistent header visible across all tabs.
2. THE Client Profile screen SHALL provide the following tabs in order: Intake, Goals, Habits, Mood & Energy, Follow-Up Notes.
3. WHEN the Coach navigates to a Client Profile screen, THE Application SHALL display the Intake tab as the default active tab.
4. WHEN the Coach selects a tab, THE Application SHALL display the content for that tab within 300ms and retain the selected tab if the Coach navigates away and returns to the same profile within the same browser session without a page reload.
5. THE Intake tab SHALL display all Client fields defined in Requirement 8 in a read-only view with an "Edit" button; WHEN the Coach clicks "Edit", THE Application SHALL switch to edit mode with all fields pre-populated; WHEN the Coach saves, THE Application SHALL switch back to read-only view with updated values; WHEN the Coach cancels, THE Application SHALL discard all unsaved changes and return to read-only view.

---

### Requirement 10: Goals Tracker

**User Story:** As a Coach, I want to track wellness goals for each client with status and target dates, so that I can monitor progress and celebrate completions.

#### Acceptance Criteria

1. THE Goals screen SHALL display all Goals across all Clients in a table with columns: Client Name, Goal Description, Why It Matters, Target Date, Goal Status, Completed Date.
2. WHILE the Goals screen is displayed, THE Application SHALL show an "Add Goal" button that opens a form to create a new Goal for a selected Client.
3. THE Goal form SHALL include the following fields: Client (required, selected from Client roster), Goal Description (required, maximum 200 characters), Why It Matters (optional, maximum 500 characters), Target Date (date picker, format YYYY-MM-DD), Goal Status (required, selection from: Not Started, In Progress, Complete).
4. WHEN the Coach sets Goal Status to Complete, THE Application SHALL automatically record the current date as the Completed Date.
5. WHEN the Coach changes Goal Status away from Complete, THE Application SHALL clear the Completed Date.
6. WHEN the Coach accesses the Goals tab within a Client Profile, THE Application SHALL display only Goals belonging to that Client with the Client field pre-populated and locked to that Client; the same columns and Add Goal functionality SHALL be available.
7. THE Goals screen SHALL support filtering by Goal Status using a dropdown filter control defaulting to "All" (showing all Goal Status values).
8. WHEN a Goal is deleted, THE Application SHALL display a confirmation dialog before removing the Goal record from Local Storage.
9. WHEN the Coach submits a Goal form with a missing required field, THE Application SHALL display an inline validation message adjacent to each missing field and SHALL NOT save the record.

---

### Requirement 11: Habit Tracker

**User Story:** As a Coach, I want to log weekly habit completion for each client across a set of common habits, so that I can identify patterns and encourage consistency.

#### Acceptance Criteria

1. THE Habits screen SHALL display a weekly view showing the week containing a Coach-selected date, defaulting to the Current Week (Monday through Sunday).
2. THE Habits screen SHALL provide Previous Week and Next Week navigation controls that shift the displayed week by 7 days in the respective direction.
3. THE Habits weekly view SHALL display one row per Client per assigned Habit, with a column for each day of the week (Monday through Sunday) containing a checkbox indicating whether that habit was completed on that day.
4. WHEN the Coach checks or unchecks a habit completion checkbox, THE Application SHALL save the change to Local Storage within 300ms.
5. THE Habits screen SHALL display the habit completion percentage for each Client for the displayed week, calculated as (total checked boxes for that Client ÷ total habit-day slots for that Client for the week) × 100 rounded to the nearest whole number; WHEN a Client has zero habits assigned, THE Application SHALL display 0%.
6. THE Common Habits available for tracking SHALL be configurable via the Settings screen as defined in Requirement 17.
7. WHEN the Coach accesses the Habits tab within a Client Profile, THE Application SHALL display the habit tracker filtered to only the habits assigned to that Client and only that Client's completion records.
8. WHEN a Client has no habits assigned, THE Application SHALL display a message within the habit grid prompting the Coach to assign habits via the Settings screen.

---

### Requirement 12: Mood and Energy Log

**User Story:** As a Coach, I want to log daily mood and energy scores for each client, so that I can identify trends and discuss them during coaching sessions.

#### Acceptance Criteria

1. THE Mood & Energy screen SHALL display a log of all Check-In records across all Clients, sorted by date descending by default, with columns: Client Name, Date, Mood Score, Energy Score, Notes.
2. THE Mood & Energy screen SHALL provide an "Add Check-In" button that opens a form to create a new Check-In.
3. THE Check-In form SHALL include: Client (required, selected from Active Clients), Date (required, defaulting to today), Mood Score (required, integer from 1 to 10 inclusive), Energy Score (required, integer from 1 to 10 inclusive), Notes (optional free text, maximum 500 characters).
4. WHEN the Coach submits a Check-In form with a Mood Score or Energy Score that is not an integer in the range of 1 to 10 inclusive, THE Application SHALL display a validation message on the affected field and SHALL NOT save the record.
5. WHEN the Coach accesses the Mood & Energy tab within a Client Profile, THE Application SHALL display only Check-Ins belonging to that Client with the Client field pre-populated and locked to that Client; the same columns and Add Check-In functionality SHALL be available.
6. WHEN the Coach selects a Client from the Client filter on the Mood & Energy screen, THE Application SHALL display a trend chart for that Client with Date on the X-axis (chronological order) and Score (1–10) on the Y-axis, plotting both Mood Score and Energy Score as separate series.
7. WHEN fewer than 2 Check-In records exist for a Client, THE Application SHALL not render the trend chart and SHALL display a message indicating insufficient data for a chart; WHEN exactly 2 or more Check-In records exist for the selected Client, THE Application SHALL render the trend chart.
8. WHEN the Coach successfully saves a new Check-In, THE Application SHALL display a success confirmation message.
9. THE Application SHALL permit multiple Check-In records for the same Client on the same date; all such entries SHALL appear as separate rows in the log.

---

### Requirement 13: Follow-Up Notes

**User Story:** As a Coach, I want to record timestamped coaching notes for each client, so that I have a historical record of all coaching interactions.

#### Acceptance Criteria

1. THE Follow-Ups screen SHALL display all Follow-Up Notes across all Clients, sorted by date descending, with columns: Client Name, Date, Note Preview (first 100 characters of note text, followed by "…" if the note exceeds 100 characters).
2. THE Follow-Ups screen SHALL provide an "Add Note" button that opens a form to create a new Follow-Up Note.
3. THE Follow-Up Note form SHALL include: Client (required, selected from Client roster), Date (required, defaulting to today), Note Text (required, minimum 1 non-whitespace character, maximum 2000 characters).
4. WHEN the Coach submits a Follow-Up Note form with Note Text that is empty or contains only whitespace characters, THE Application SHALL display a validation message and SHALL NOT save the record.
5. WHEN the Coach types in the search input on the Follow-Ups screen, THE Application SHALL filter the notes list to show only notes whose Client Name or Note Text contains the typed string (case-insensitive), with results updating within 300ms of each keystroke.
6. WHEN the Coach accesses the Follow-Up Notes tab within a Client Profile, THE Application SHALL display only Follow-Up Notes belonging to that Client with the Client field pre-populated and locked to that Client; the same columns and Add Note functionality SHALL be available.
7. WHEN the Coach confirms deletion of a Follow-Up Note in the confirmation dialog, THE Application SHALL permanently remove the record from Local Storage and from all views.
8. WHEN the Coach cancels deletion in the confirmation dialog, THE Application SHALL close the dialog and leave the Follow-Up Note record unchanged.

---

### Requirement 14: Editing and Deleting Records

**User Story:** As a Coach, I want to edit or delete any record I have created, so that I can correct mistakes and keep data accurate.

#### Acceptance Criteria

1. THE Application SHALL provide an Edit action for every Goal, Check-In, and Follow-Up Note record in every table or list where those records are displayed.
2. WHEN the Coach selects Edit for a record, THE Application SHALL open the record's form pre-populated with the existing field values.
3. WHEN the Coach submits an edited record form that passes validation, THE Application SHALL update the record in Local Storage and reflect the update in all views within 500ms.
4. WHEN the Coach submits an edited record form that fails validation, THE Application SHALL display inline validation messages on each invalid field, retain the Coach's entered values in the form, and SHALL NOT save the record to Local Storage.
5. THE Application SHALL provide a Delete action for every Goal, Check-In, and Follow-Up Note record.
6. WHEN the Coach selects Delete for a record, THE Application SHALL display a confirmation dialog with explicit "Confirm" and "Cancel" options, stating the record will be permanently removed.
7. WHEN the Coach confirms deletion, THE Application SHALL remove the record from Local Storage and from all views within 500ms.
8. WHEN the Coach selects Cancel in the deletion confirmation dialog, THE Application SHALL close the dialog and leave the record unchanged.

---

### Requirement 15: Data Export

**User Story:** As a Coach, I want to export my data to a file, so that I can back it up or transfer it to another device.

#### Acceptance Criteria

1. THE Application SHALL provide a data export function accessible from the Settings screen that exports all Application data as a single JSON file.
2. WHEN the Coach triggers the export, THE Application SHALL generate a JSON file containing all Client, Goal, Habit, Check-In, and Follow-Up Note records and prompt the browser's native file download dialog; WHEN the download is successfully initiated, THE Application SHALL display a success confirmation message.
3. THE exported JSON file SHALL be named using the pattern `health-concierge-export-YYYY-MM-DD.json` where the date reflects the export date in the Coach's local time zone.
4. IF the export fails due to a browser or file system error, THEN THE Application SHALL display an error message stating the export could not be completed and SHALL NOT leave a partial or corrupted file.
5. WHEN the Coach triggers the export and no records of any type exist, THE Application SHALL still generate and download a valid JSON file representing an empty data set.

---

### Requirement 16: Data Import

**User Story:** As a Coach, I want to import a previously exported data file, so that I can restore data or migrate between devices.

#### Acceptance Criteria

1. THE Application SHALL provide a data import function accessible from the Settings screen that accepts a JSON file in the format produced by the export function defined in Requirement 15.
2. WHEN the Coach triggers import and selects a valid export file, THE Application SHALL display a confirmation dialog warning that the import will replace all current Local Storage data before proceeding.
3. WHEN the Coach confirms the import, THE Application SHALL atomically replace all Local Storage records with the records from the imported file and reload the Application state so that the UI reflects the imported records without requiring a manual page refresh.
4. IF the selected file is not a valid export file or is malformed JSON, THEN THE Application SHALL display an error message that identifies whether the failure is due to malformed JSON syntax or missing required fields, and SHALL NOT modify any existing Local Storage data.
5. THE Application SHALL ensure that for any valid export file, importing the file and then exporting the resulting data produces a JSON file with the same entity types, record counts, and field values as the original import file (round-trip property).
6. WHEN the Coach selects Cancel in the import confirmation dialog, THE Application SHALL close the dialog and leave all existing Local Storage data unchanged.

---

### Requirement 17: Settings — Reference Data Management

**User Story:** As a Coach, I want to manage the reference lists used across the application (habits, support styles, priority levels, client statuses, goal statuses), so that the application reflects my practice's terminology and needs.

#### Acceptance Criteria

1. THE Settings screen SHALL display the following editable reference lists: Common Habits, Support Styles, Priority Levels, Client Status Values, Goal Status Values.
2. THE Settings screen SHALL pre-populate each list with the following default values on first launch:
   - Common Habits: Hydration (80oz water), Exercise/Movement, Sleep Goal (7–8 hrs), Nutrition Plan, Protein Target, Mindful Eating, Medication Compliance
   - Support Styles: Weekly Check-In, Bi-Weekly Check-In, Monthly Review, On-Demand, Intensive Daily
   - Priority Levels: High, Medium, Low
   - Client Status Values: Active, Inactive, Graduated
   - Goal Status Values: Not Started, In Progress, Complete
3. WHEN the Coach enters a new item name (between 1 and 50 characters, not a case-insensitive duplicate of an existing item in the same list) and confirms the addition, THE Application SHALL add the item to the reference list; WHEN the new item name fails validation, THE Application SHALL display an inline error and retain the entered value in the input field.
4. WHEN the Coach attempts to delete the last remaining item in a reference list, THE Application SHALL display an error message stating that at least one item must remain and SHALL NOT remove the item.
5. WHEN the Coach attempts to delete a reference list item that is currently assigned to one or more records, THE Application SHALL display a warning identifying the names and count of affected records.
6. WHEN the Coach confirms deletion of a reference list item (after acknowledging any warning from criterion 5), THE Application SHALL remove the item from the reference list and display a legacy label marked "(removed)" on all existing records that referenced that item.

---

### Requirement 18: Form Accessibility and Keyboard Navigation

**User Story:** As a Coach, I want to use the application efficiently with a keyboard and with standard assistive technologies, so that the tool is accessible in a professional setting.

#### Acceptance Criteria

1. THE Application SHALL ensure all interactive elements are reachable and operable via keyboard: buttons and links SHALL be activated with Enter; checkboxes SHALL be toggled with Space; tab panels SHALL be navigated with arrow keys; all elements SHALL be included in the Tab and Shift+Tab focus order.
2. THE Application SHALL provide visible focus indicators on all interactive elements with a minimum outline width of 2px that meet WCAG 2.1 AA contrast requirements for focus indicators.
3. THE Application SHALL associate all form input fields with a visible label element using standard HTML label/for or aria-labelledby attributes; required fields SHALL be marked with a visible indicator and include `aria-required="true"`.
4. THE Application SHALL provide ARIA live region announcements for dynamic content updates: record save confirmations and non-error notifications SHALL use `aria-live="polite"`; validation errors and destructive action confirmations SHALL use `aria-live="assertive"`; all announcements SHALL appear in the live region within 1 second of the triggering event.
5. WHEN a modal dialog or confirmation dialog is opened, THE Application SHALL trap keyboard focus within the dialog until it is closed, preventing Tab and Shift+Tab from reaching elements outside the dialog.
6. WHEN a non-blocking notification or toast is displayed, THE Application SHALL NOT trap keyboard focus; instead, THE Application SHALL announce the notification content via an `aria-live="polite"` region while keeping the Coach's focus position unchanged.

---

### Requirement 19: Responsive Layout

**User Story:** As a Coach, I want the application to be usable on both desktop and tablet screens, so that I can reference it during sessions on different devices.

#### Acceptance Criteria

1. THE Application SHALL render all content without horizontal scrollbar activation and without any content being clipped or hidden outside the viewport on screens with a viewport width of 768px or greater; "clipped" means any portion of text, button, or interactive control being cut off by the viewport edge.
2. WHILE the viewport width is between 768px and 1024px inclusive, THE Application SHALL apply horizontal scroll to data tables or switch to stacked card layouts for any table where columns would otherwise overflow the viewport, ensuring no table column content is clipped.
3. WHILE the viewport width is 1025px or greater, THE Application SHALL use full-column desktop table layouts with all columns visible simultaneously.
4. THE Application SHALL maintain full functionality on touch-enabled devices with viewport widths of 768px or greater; specifically, all buttons, checkboxes, form inputs, and navigation items SHALL have a minimum touch target size of 44×44 CSS pixels, and all drag-based or hover-only interactions SHALL have an equivalent tap-based alternative.

---

### Requirement 20: Visual Design and Professionalism

**User Story:** As a Coach, I want the application to have a premium, clean visual design, so that it reflects the professionalism of my practice.

#### Acceptance Criteria

1. THE Application SHALL implement all colors, typography sizes, and spacing values as design tokens (CSS custom properties or equivalent), and all UI components SHALL reference only those tokens rather than hardcoded values, ensuring uniform application of the design system across all screens.
2. THE Application SHALL display status badges for Client Status, Goal Status, and Priority Level as color-coded pill labels where each distinct status value has a unique background color not shared by any other status value in the same category, enabling rapid visual differentiation.
3. WHEN the Coach triggers a tab switch, modal opening, navigation change, or modal closing, THE Application SHALL apply a CSS transition with a duration between 100ms and 300ms inclusive for both the enter and exit phases of the animated element.
4. THE Application SHALL ensure all text and interactive element foreground/background color combinations — including status badges and color-coded components — meet WCAG 2.1 AA minimum contrast ratios: 4.5:1 for normal text (below 18pt / 14pt bold) and 3:1 for large text and UI components.
