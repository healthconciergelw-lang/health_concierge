/**
 * mockData.js — First-launch seed data
 *
 * Called by main.js on first launch (when `hc:initialized` is absent).
 * Populates all 7 collections in the store with realistic sample data so
 * the coach sees a meaningful UI immediately.
 *
 * Hardcoded UUIDs are used for predictability — they allow cross-referencing
 * between entities without dynamic ID generation, and they remain stable
 * across re-seeds if the initialized flag is ever cleared during development.
 */

// ---------------------------------------------------------------------------
// Hardcoded UUIDs
// ---------------------------------------------------------------------------

// Clients
const CLIENT_1_ID = 'a1b2c3d4-0001-4000-8000-000000000001';
const CLIENT_2_ID = 'a1b2c3d4-0002-4000-8000-000000000002';

// Goals
const GOAL_1_ID = 'b2c3d4e5-0001-4000-8000-000000000001';
const GOAL_2_ID = 'b2c3d4e5-0002-4000-8000-000000000002';
const GOAL_3_ID = 'b2c3d4e5-0003-4000-8000-000000000003';

// Habit Assignments
const HABIT_ASSIGN_1_ID = 'c3d4e5f6-0001-4000-8000-000000000001';
const HABIT_ASSIGN_2_ID = 'c3d4e5f6-0002-4000-8000-000000000002';
const HABIT_ASSIGN_3_ID = 'c3d4e5f6-0003-4000-8000-000000000003';
const HABIT_ASSIGN_4_ID = 'c3d4e5f6-0004-4000-8000-000000000004';

// Habit Completions
const HABIT_COMP_1_ID = 'd4e5f6a7-0001-4000-8000-000000000001';
const HABIT_COMP_2_ID = 'd4e5f6a7-0002-4000-8000-000000000002';
const HABIT_COMP_3_ID = 'd4e5f6a7-0003-4000-8000-000000000003';
const HABIT_COMP_4_ID = 'd4e5f6a7-0004-4000-8000-000000000004';
const HABIT_COMP_5_ID = 'd4e5f6a7-0005-4000-8000-000000000005';

// Check-Ins
const CHECKIN_1_ID = 'e5f6a7b8-0001-4000-8000-000000000001';
const CHECKIN_2_ID = 'e5f6a7b8-0002-4000-8000-000000000002';
const CHECKIN_3_ID = 'e5f6a7b8-0003-4000-8000-000000000003';

// Follow-Up Notes
const NOTE_1_ID = 'f6a7b8c9-0001-4000-8000-000000000001';
const NOTE_2_ID = 'f6a7b8c9-0002-4000-8000-000000000002';
const NOTE_3_ID = 'f6a7b8c9-0003-4000-8000-000000000003';

// ---------------------------------------------------------------------------
// Date helpers (relative to today, no external dependency)
// ---------------------------------------------------------------------------

/**
 * Returns an ISO date string (YYYY-MM-DD) for a date `n` days from today.
 * Negative n goes into the past; positive n goes into the future.
 * @param {number} n
 * @returns {string}
 */
function relativeDate(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day   = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns an ISO 8601 datetime string for a date `n` days from today.
 * @param {number} n
 * @returns {string}
 */
function relativeDatetime(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Default Settings
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS = {
  commonHabits: [
    'Hydration (80oz water)',
    'Exercise/Movement',
    'Sleep Goal (7–8 hrs)',
    'Nutrition Plan',
    'Protein Target',
    'Mindful Eating',
    'Medication Compliance',
  ],
  supportStyles: [
    'Weekly Check-In',
    'Bi-Weekly Check-In',
    'Monthly Review',
    'On-Demand',
    'Intensive Daily',
  ],
  priorityLevels: ['High', 'Medium', 'Low'],
  clientStatusValues: ['Active', 'Inactive', 'Graduated'],
  goalStatusValues: ['Not Started', 'In Progress', 'Complete'],
};

// ---------------------------------------------------------------------------
// Mock Clients
// ---------------------------------------------------------------------------

const MOCK_CLIENTS = [
  {
    id: CLIENT_1_ID,
    clientId: 'AJ-001',
    fullName: 'Alex Johnson',
    startWeight: 218,
    currentWeight: 204,
    nextAppointment: relativeDate(5),
    priorityLevel: 'High',
    status: 'Active',
    supportStyle: 'Weekly Check-In',
    createdAt: relativeDatetime(-45),
    updatedAt: relativeDatetime(-3),
  },
  {
    id: CLIENT_2_ID,
    clientId: 'MS-002',
    fullName: 'Maria Santos',
    startWeight: 165,
    currentWeight: 158,
    nextAppointment: relativeDate(12),
    priorityLevel: 'Medium',
    status: 'Active',
    supportStyle: 'Bi-Weekly Check-In',
    createdAt: relativeDatetime(-60),
    updatedAt: relativeDatetime(-7),
  },
];

// ---------------------------------------------------------------------------
// Mock Goals
// ---------------------------------------------------------------------------

const MOCK_GOALS = [
  {
    id: GOAL_1_ID,
    clientId: CLIENT_1_ID,
    description: 'Lose 20 lbs by summer',
    whyItMatters: 'Improve energy and reduce joint pain for daily activities.',
    targetDate: relativeDate(60),
    status: 'In Progress',
    completedDate: null,
    createdAt: relativeDatetime(-45),
    updatedAt: relativeDatetime(-3),
  },
  {
    id: GOAL_2_ID,
    clientId: CLIENT_1_ID,
    description: 'Drink 80oz of water daily',
    whyItMatters: 'Staying hydrated helps with metabolism and reduces cravings.',
    targetDate: relativeDate(30),
    status: 'In Progress',
    completedDate: null,
    createdAt: relativeDatetime(-40),
    updatedAt: relativeDatetime(-5),
  },
  {
    id: GOAL_3_ID,
    clientId: CLIENT_2_ID,
    description: 'Complete 30-day meal prep challenge',
    whyItMatters: 'Building a sustainable cooking routine to support the nutrition plan.',
    targetDate: relativeDate(20),
    status: 'In Progress',
    completedDate: null,
    createdAt: relativeDatetime(-60),
    updatedAt: relativeDatetime(-7),
  },
];

// ---------------------------------------------------------------------------
// Mock Habit Assignments
// ---------------------------------------------------------------------------

const MOCK_HABIT_ASSIGNMENTS = [
  {
    id: HABIT_ASSIGN_1_ID,
    clientId: CLIENT_1_ID,
    habitName: 'Hydration (80oz water)',
    createdAt: relativeDatetime(-45),
  },
  {
    id: HABIT_ASSIGN_2_ID,
    clientId: CLIENT_1_ID,
    habitName: 'Exercise/Movement',
    createdAt: relativeDatetime(-45),
  },
  {
    id: HABIT_ASSIGN_3_ID,
    clientId: CLIENT_2_ID,
    habitName: 'Nutrition Plan',
    createdAt: relativeDatetime(-60),
  },
  {
    id: HABIT_ASSIGN_4_ID,
    clientId: CLIENT_2_ID,
    habitName: 'Sleep Goal (7–8 hrs)',
    createdAt: relativeDatetime(-60),
  },
];

// ---------------------------------------------------------------------------
// Mock Habit Completions (current week — days relative to today)
// ---------------------------------------------------------------------------

const MOCK_HABIT_COMPLETIONS = [
  {
    id: HABIT_COMP_1_ID,
    habitAssignmentId: HABIT_ASSIGN_1_ID,
    date: relativeDate(-6),
    completed: true,
  },
  {
    id: HABIT_COMP_2_ID,
    habitAssignmentId: HABIT_ASSIGN_1_ID,
    date: relativeDate(-5),
    completed: true,
  },
  {
    id: HABIT_COMP_3_ID,
    habitAssignmentId: HABIT_ASSIGN_2_ID,
    date: relativeDate(-6),
    completed: true,
  },
  {
    id: HABIT_COMP_4_ID,
    habitAssignmentId: HABIT_ASSIGN_3_ID,
    date: relativeDate(-4),
    completed: true,
  },
  {
    id: HABIT_COMP_5_ID,
    habitAssignmentId: HABIT_ASSIGN_4_ID,
    date: relativeDate(-3),
    completed: true,
  },
];

// ---------------------------------------------------------------------------
// Mock Check-Ins
// ---------------------------------------------------------------------------

const MOCK_CHECK_INS = [
  {
    id: CHECKIN_1_ID,
    clientId: CLIENT_1_ID,
    date: relativeDate(-7),
    moodScore: 7,
    energyScore: 6,
    notes: 'Had a great week. Feeling motivated and starting to see progress.',
    createdAt: relativeDatetime(-7),
    updatedAt: relativeDatetime(-7),
  },
  {
    id: CHECKIN_2_ID,
    clientId: CLIENT_1_ID,
    date: relativeDate(-14),
    moodScore: 5,
    energyScore: 4,
    notes: 'Struggled with sleep this week. Cravings were high mid-week.',
    createdAt: relativeDatetime(-14),
    updatedAt: relativeDatetime(-14),
  },
  {
    id: CHECKIN_3_ID,
    clientId: CLIENT_2_ID,
    date: relativeDate(-5),
    moodScore: 8,
    energyScore: 8,
    notes: 'Meal prep is going well. Energy has noticeably improved.',
    createdAt: relativeDatetime(-5),
    updatedAt: relativeDatetime(-5),
  },
];

// ---------------------------------------------------------------------------
// Mock Follow-Up Notes
// ---------------------------------------------------------------------------

const MOCK_FOLLOW_UP_NOTES = [
  {
    id: NOTE_1_ID,
    clientId: CLIENT_1_ID,
    date: relativeDate(-3),
    noteText:
      'Alex mentioned struggling with late-night snacking. Recommended prepping a healthy evening snack option to have ready. Will follow up next session.',
    createdAt: relativeDatetime(-3),
    updatedAt: relativeDatetime(-3),
  },
  {
    id: NOTE_2_ID,
    clientId: CLIENT_1_ID,
    date: relativeDate(-10),
    noteText:
      'Reviewed hydration tracker. Alex is consistently hitting 70oz but not quite the 80oz goal. Suggested carrying a larger water bottle.',
    createdAt: relativeDatetime(-10),
    updatedAt: relativeDatetime(-10),
  },
  {
    id: NOTE_3_ID,
    clientId: CLIENT_2_ID,
    date: relativeDate(-5),
    noteText:
      'Maria completed her first full week of meal prep. She feels confident in the routine and asked about adding variety to the protein sources.',
    createdAt: relativeDatetime(-5),
    updatedAt: relativeDatetime(-5),
  },
];

// ---------------------------------------------------------------------------
// Seed function
// ---------------------------------------------------------------------------

/**
 * Seeds the store with default settings and sample data for all collections.
 * Should only be called once, when `hc:initialized` is absent from localStorage.
 *
 * @param {import('./store.js').store} store - The application store instance
 */
export function seedMockData(store) {
  store.set('settings',          DEFAULT_SETTINGS);
  store.set('clients',           MOCK_CLIENTS);
  store.set('goals',             MOCK_GOALS);
  store.set('habitAssignments',  MOCK_HABIT_ASSIGNMENTS);
  store.set('habitCompletions',  MOCK_HABIT_COMPLETIONS);
  store.set('checkIns',          MOCK_CHECK_INS);
  store.set('followUpNotes',     MOCK_FOLLOW_UP_NOTES);
}
