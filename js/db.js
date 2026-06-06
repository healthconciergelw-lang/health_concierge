/**
 * db.js — Data-access layer (business-logic CRUD)
 *
 * All reads come from the in-memory store (fast, synchronous).
 * All writes go through store.set(), which flushes to localStorage within 300ms.
 *
 * Module sections (added across tasks):
 *   3.3 — Client CRUD
 *   3.4 — Goals, Habits, CheckIns, FollowUpNotes CRUD  (added in task 3.4)
 *   3.6 — Settings CRUD and reference data management   (added in task 3.6)
 *
 * Never import db.js from store.js or utils.js — dependency direction is:
 *   modules → db.js → store.js
 *                   → utils.js
 */

import { store } from './store.js';
import { generateId, today } from './utils.js';

// ===========================================================================
// Section 1: Client CRUD  (task 3.3)
// ===========================================================================

export const db = {
  // -------------------------------------------------------------------------
  // db.getClients()
  // Returns a shallow-copy array of all Client records.
  // -------------------------------------------------------------------------
  getClients() {
    return store.get('clients');
  },

  // -------------------------------------------------------------------------
  // db.getClientById(id)
  // Finds a client by its system UUID (client.id), not clientId.
  // Returns the client object or undefined if not found.
  // -------------------------------------------------------------------------
  getClientById(id) {
    const clients = store.get('clients');
    return clients.find((c) => c.id === id);
  },

  // -------------------------------------------------------------------------
  // db.saveClient(data)
  //
  // Create or update a Client record.
  //
  // • If data.id is absent/falsy → CREATE:
  //     - generate a new UUID for id
  //     - set createdAt to the current ISO datetime
  //
  // • If data.id is present → UPDATE:
  //     - find existing record; replace all fields with data's fields
  //
  // Always sets updatedAt to the current ISO datetime.
  //
  // Uniqueness: data.clientId must not already be used by any OTHER client
  // (a different client.id). Throws an error object with { field, message }
  // on violation so the form layer can surface an inline error.
  //
  // Returns the saved client object on success.
  // -------------------------------------------------------------------------
  saveClient(data) {
    const clients = store.get('clients');
    const now = new Date().toISOString();

    // Enforce unique clientId across all OTHER records
    const duplicate = clients.find(
      (c) => c.clientId === data.clientId && c.id !== data.id
    );
    if (duplicate) {
      const err = {
        field: 'clientId',
        message: 'A client with this ID already exists.',
      };
      throw err;
    }

    let saved;

    if (!data.id) {
      // --- CREATE ---
      saved = {
        ...data,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      };
      clients.push(saved);
    } else {
      // --- UPDATE ---
      const idx = clients.findIndex((c) => c.id === data.id);
      if (idx === -1) {
        throw new Error(`Client with id "${data.id}" not found.`);
      }
      saved = {
        ...clients[idx],
        ...data,
        updatedAt: now,
      };
      clients[idx] = saved;
    }

    store.set('clients', clients);
    return saved;
  },

  // -------------------------------------------------------------------------
  // db.deleteClient(id)
  //
  // Permanently removes the client record and ALL associated child records:
  //   • Goals            where goal.clientId === id
  //   • HabitAssignments where habitAssignment.clientId === id
  //   • HabitCompletions where habitCompletion.habitAssignmentId is in the
  //                        set of deleted HabitAssignment ids
  //   • CheckIns         where checkIn.clientId === id
  //   • FollowUpNotes    where followUpNote.clientId === id
  //
  // Saves every modified collection back to the store.
  // Returns true when the client existed and was deleted, false otherwise.
  // -------------------------------------------------------------------------
  deleteClient(id) {
    const clients = store.get('clients');
    const clientIdx = clients.findIndex((c) => c.id === id);
    if (clientIdx === -1) return false;

    // Remove the client
    clients.splice(clientIdx, 1);
    store.set('clients', clients);

    // Cascade: Goals
    const goals = store.get('goals').filter((g) => g.clientId !== id);
    store.set('goals', goals);

    // Cascade: HabitAssignments (collect deleted ids for HabitCompletions)
    const allAssignments = store.get('habitAssignments');
    const deletedAssignmentIds = new Set(
      allAssignments.filter((a) => a.clientId === id).map((a) => a.id)
    );
    const remainingAssignments = allAssignments.filter((a) => a.clientId !== id);
    store.set('habitAssignments', remainingAssignments);

    // Cascade: HabitCompletions (via deleted habitAssignmentIds)
    const completions = store
      .get('habitCompletions')
      .filter((hc) => !deletedAssignmentIds.has(hc.habitAssignmentId));
    store.set('habitCompletions', completions);

    // Cascade: CheckIns
    const checkIns = store.get('checkIns').filter((ci) => ci.clientId !== id);
    store.set('checkIns', checkIns);

    // Cascade: FollowUpNotes
    const notes = store.get('followUpNotes').filter((n) => n.clientId !== id);
    store.set('followUpNotes', notes);

    return true;
  },

  // ===========================================================================
  // Section 2: Goals CRUD  (task 3.4)
  // ===========================================================================

  // -------------------------------------------------------------------------
  // db.getGoals()
  // Returns a shallow-copy array of all Goal records.
  // -------------------------------------------------------------------------
  getGoals() {
    return store.get('goals');
  },

  // -------------------------------------------------------------------------
  // db.saveGoal(data)
  //
  // Create or update a Goal record.
  //
  // • If data.id is absent/falsy → CREATE (new UUID, set createdAt)
  // • If data.id is present      → UPDATE (merge into existing record)
  //
  // Always sets updatedAt to the current ISO datetime.
  //
  // Requirement 10.4 / 10.5 — completedDate auto-management:
  //   • If status === 'Complete' and completedDate is null/undefined/empty,
  //     set completedDate to today's ISO date string.
  //   • If status !== 'Complete', always clear completedDate to null.
  //
  // Returns the saved goal object.
  // -------------------------------------------------------------------------
  saveGoal(data) {
    const goals = store.get('goals');
    const now = new Date().toISOString();

    // Auto-manage completedDate based on status (Requirements 10.4, 10.5)
    let completedDate = data.completedDate ?? null;
    if (data.status === 'Complete') {
      if (!completedDate) {
        completedDate = today();
      }
    } else {
      completedDate = null;
    }

    let saved;

    if (!data.id) {
      // --- CREATE ---
      saved = {
        ...data,
        id: generateId(),
        completedDate,
        createdAt: now,
        updatedAt: now,
      };
      goals.push(saved);
    } else {
      // --- UPDATE ---
      const idx = goals.findIndex((g) => g.id === data.id);
      if (idx === -1) {
        throw new Error(`Goal with id "${data.id}" not found.`);
      }
      saved = {
        ...goals[idx],
        ...data,
        completedDate,
        updatedAt: now,
      };
      goals[idx] = saved;
    }

    store.set('goals', goals);
    return saved;
  },

  // -------------------------------------------------------------------------
  // db.deleteGoal(id)
  //
  // Permanently removes the Goal record with the given id.
  // Returns true if the record existed and was removed, false otherwise.
  // -------------------------------------------------------------------------
  deleteGoal(id) {
    const goals = store.get('goals');
    const filtered = goals.filter((g) => g.id !== id);
    if (filtered.length === goals.length) return false;
    store.set('goals', filtered);
    return true;
  },

  // ===========================================================================
  // Section 2b: Habit Assignment + Completion CRUD  (task 3.4)
  // ===========================================================================

  // -------------------------------------------------------------------------
  // db.getHabitAssignments()
  // Returns a shallow-copy array of all HabitAssignment records.
  // -------------------------------------------------------------------------
  getHabitAssignments() {
    return store.get('habitAssignments');
  },

  // -------------------------------------------------------------------------
  // db.saveHabitAssignment(data)
  //
  // Create or update a HabitAssignment record.
  //
  // • If data.id is absent/falsy → CREATE (new UUID, set createdAt)
  // • If data.id is present      → UPDATE (merge into existing record)
  //
  // Returns the saved habitAssignment object.
  // -------------------------------------------------------------------------
  saveHabitAssignment(data) {
    const assignments = store.get('habitAssignments');
    const now = new Date().toISOString();

    let saved;

    if (!data.id) {
      // --- CREATE ---
      saved = {
        ...data,
        id: generateId(),
        createdAt: now,
      };
      assignments.push(saved);
    } else {
      // --- UPDATE ---
      const idx = assignments.findIndex((a) => a.id === data.id);
      if (idx === -1) {
        throw new Error(`HabitAssignment with id "${data.id}" not found.`);
      }
      saved = {
        ...assignments[idx],
        ...data,
      };
      assignments[idx] = saved;
    }

    store.set('habitAssignments', assignments);
    return saved;
  },

  // -------------------------------------------------------------------------
  // db.deleteHabitAssignment(id)
  //
  // Permanently removes the HabitAssignment record and all associated
  // HabitCompletion records (cascade).
  // Returns true if the assignment existed and was removed, false otherwise.
  // -------------------------------------------------------------------------
  deleteHabitAssignment(id) {
    const assignments = store.get('habitAssignments');
    const filtered = assignments.filter((a) => a.id !== id);
    if (filtered.length === assignments.length) return false;
    store.set('habitAssignments', filtered);

    // Cascade: remove all completions for this assignment
    const completions = store
      .get('habitCompletions')
      .filter((hc) => hc.habitAssignmentId !== id);
    store.set('habitCompletions', completions);

    return true;
  },

  // -------------------------------------------------------------------------
  // db.setHabitCompletion(habitAssignmentId, date, checked)
  //
  // Toggles (creates or removes) a HabitCompletion record for a given
  // (habitAssignmentId, date) pair. (Requirement 11.4)
  //
  // • checked = true  → ensure a record exists; create one if not found
  // • checked = false → ensure no record exists; remove it if found
  //
  // Returns the created HabitCompletion object when checked=true, or null
  // when checked=false (record removed or was already absent).
  // -------------------------------------------------------------------------
  setHabitCompletion(habitAssignmentId, date, checked) {
    const completions = store.get('habitCompletions');
    const existingIdx = completions.findIndex(
      (hc) => hc.habitAssignmentId === habitAssignmentId && hc.date === date
    );

    if (checked) {
      if (existingIdx !== -1) {
        // Already exists — nothing to do
        return completions[existingIdx];
      }
      // Create a new completion record
      const newRecord = {
        id: generateId(),
        habitAssignmentId,
        date,
        completed: true,
      };
      completions.push(newRecord);
      store.set('habitCompletions', completions);
      return newRecord;
    } else {
      if (existingIdx === -1) {
        // Already absent — nothing to do
        return null;
      }
      completions.splice(existingIdx, 1);
      store.set('habitCompletions', completions);
      return null;
    }
  },

  // ===========================================================================
  // Section 2c: Check-In CRUD  (task 3.4)
  // ===========================================================================

  // -------------------------------------------------------------------------
  // db.getCheckIns()
  // Returns a shallow-copy array of all CheckIn records.
  // -------------------------------------------------------------------------
  getCheckIns() {
    return store.get('checkIns');
  },

  // -------------------------------------------------------------------------
  // db.saveCheckIn(data)
  //
  // Create or update a CheckIn record.
  //
  // • If data.id is absent/falsy → CREATE (new UUID, set createdAt)
  // • If data.id is present      → UPDATE (merge into existing record)
  //
  // Always sets updatedAt to the current ISO datetime.
  // Returns the saved checkIn object.
  // -------------------------------------------------------------------------
  saveCheckIn(data) {
    const checkIns = store.get('checkIns');
    const now = new Date().toISOString();

    let saved;

    if (!data.id) {
      // --- CREATE ---
      saved = {
        ...data,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      };
      checkIns.push(saved);
    } else {
      // --- UPDATE ---
      const idx = checkIns.findIndex((ci) => ci.id === data.id);
      if (idx === -1) {
        throw new Error(`CheckIn with id "${data.id}" not found.`);
      }
      saved = {
        ...checkIns[idx],
        ...data,
        updatedAt: now,
      };
      checkIns[idx] = saved;
    }

    store.set('checkIns', checkIns);
    return saved;
  },

  // -------------------------------------------------------------------------
  // db.deleteCheckIn(id)
  //
  // Permanently removes the CheckIn record with the given id.
  // Returns true if the record existed and was removed, false otherwise.
  // -------------------------------------------------------------------------
  deleteCheckIn(id) {
    const checkIns = store.get('checkIns');
    const filtered = checkIns.filter((ci) => ci.id !== id);
    if (filtered.length === checkIns.length) return false;
    store.set('checkIns', filtered);
    return true;
  },

  // ===========================================================================
  // Section 2d: Follow-Up Note CRUD  (task 3.4)
  // ===========================================================================

  // -------------------------------------------------------------------------
  // db.getFollowUpNotes()
  // Returns a shallow-copy array of all FollowUpNote records.
  // -------------------------------------------------------------------------
  getFollowUpNotes() {
    return store.get('followUpNotes');
  },

  // -------------------------------------------------------------------------
  // db.saveFollowUpNote(data)
  //
  // Create or update a FollowUpNote record.
  //
  // • If data.id is absent/falsy → CREATE (new UUID, set createdAt)
  // • If data.id is present      → UPDATE (merge into existing record)
  //
  // Always sets updatedAt to the current ISO datetime.
  // Returns the saved followUpNote object.
  // -------------------------------------------------------------------------
  saveFollowUpNote(data) {
    const notes = store.get('followUpNotes');
    const now = new Date().toISOString();

    let saved;

    if (!data.id) {
      // --- CREATE ---
      saved = {
        ...data,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      };
      notes.push(saved);
    } else {
      // --- UPDATE ---
      const idx = notes.findIndex((n) => n.id === data.id);
      if (idx === -1) {
        throw new Error(`FollowUpNote with id "${data.id}" not found.`);
      }
      saved = {
        ...notes[idx],
        ...data,
        updatedAt: now,
      };
      notes[idx] = saved;
    }

    store.set('followUpNotes', notes);
    return saved;
  },

  // -------------------------------------------------------------------------
  // db.deleteFollowUpNote(id)
  //
  // Permanently removes the FollowUpNote record with the given id.
  // Returns true if the record existed and was removed, false otherwise.
  // -------------------------------------------------------------------------
  deleteFollowUpNote(id) {
    const notes = store.get('followUpNotes');
    const filtered = notes.filter((n) => n.id !== id);
    if (filtered.length === notes.length) return false;
    store.set('followUpNotes', filtered);
    return true;
  },

  // ===========================================================================
  // Section 3: Settings CRUD and reference data management  (task 3.6)
  // ===========================================================================

  // -------------------------------------------------------------------------
  // db.getSettings()
  // Returns the settings object from the store (shallow copy).
  // -------------------------------------------------------------------------
  getSettings() {
    return store.get('settings');
  },

  // -------------------------------------------------------------------------
  // db.saveSettings(data)
  // Persists the given settings object and returns it.
  // -------------------------------------------------------------------------
  saveSettings(data) {
    store.set('settings', data);
    return data;
  },

  // -------------------------------------------------------------------------
  // db.addReferenceItem(listKey, value)
  //
  // Adds a new item to one of the five editable reference lists in Settings.
  //
  // listKey is one of:
  //   commonHabits | supportStyles | priorityLevels |
  //   clientStatusValues | goalStatusValues
  //
  // Validation (Requirement 17.3):
  //   • value.trim().length must be 1–50 characters
  //   • value must not already exist in the list (case-insensitive)
  //
  // Returns:
  //   { success: true }                           — item added
  //   { error: '<message>' }                      — validation failed
  // -------------------------------------------------------------------------
  addReferenceItem(listKey, value) {
    const trimmed = String(value).trim();

    // Length validation
    if (trimmed.length < 1 || trimmed.length > 50) {
      return { error: 'Item name must be between 1 and 50 characters.' };
    }

    const settings = store.get('settings');
    const list = settings[listKey] ?? [];

    // Case-insensitive duplicate check
    const lower = trimmed.toLowerCase();
    const duplicate = list.some((item) => item.toLowerCase() === lower);
    if (duplicate) {
      return { error: 'This item already exists in the list.' };
    }

    list.push(trimmed);
    settings[listKey] = list;
    this.saveSettings(settings);

    return { success: true };
  },

  // -------------------------------------------------------------------------
  // db.deleteReferenceItem(listKey, value, _unused, options)
  //
  // Removes an item from a reference list with safety checks.
  //
  // Reference map (what field to scan per listKey):
  //   commonHabits       → habitAssignments[].habitName
  //   supportStyles      → clients[].supportStyle
  //   priorityLevels     → clients[].priorityLevel
  //   clientStatusValues → clients[].status
  //   goalStatusValues   → goals[].status
  //
  // Behaviour (Requirements 17.4, 17.5, 17.6):
  //   1. If the list has only 1 item, return { error: '...' } — cannot delete.
  //   2. Find all records that reference this value.
  //   3. If references exist AND options.confirmed !== true, return a warning
  //      object so the UI can show a confirmation dialog:
  //        { warning: true, count: N, affectedNames: [...], listKey, value }
  //   4. On confirmed deletion (or no references):
  //      • Remove value from the settings list.
  //      • Replace all occurrences in referencing records with value + ' (removed)'.
  //      • Persist every affected collection.
  //      • Return { success: true }.
  //
  // Signature: deleteReferenceItem(listKey, value, _unused, options = {})
  // -------------------------------------------------------------------------
  deleteReferenceItem(listKey, value, _unused, options = {}) {
    const settings = store.get('settings');
    const list = settings[listKey] ?? [];

    // Requirement 17.4: prevent deletion of last item
    if (list.length <= 1) {
      return { error: 'At least one item must remain in the list.' };
    }

    // -----------------------------------------------------------------------
    // Determine which records reference this value and collect affected names
    // -----------------------------------------------------------------------
    let affectedNames = [];

    if (listKey === 'commonHabits') {
      const assignments = store.get('habitAssignments');
      const affected = assignments.filter((a) => a.habitName === value);
      // Resolve client names for display
      const clients = store.get('clients');
      const clientMap = new Map(clients.map((c) => [c.id, c.fullName]));
      affectedNames = affected.map(
        (a) => clientMap.get(a.clientId) ?? a.clientId
      );
    } else if (listKey === 'supportStyles') {
      const clients = store.get('clients');
      affectedNames = clients
        .filter((c) => c.supportStyle === value)
        .map((c) => c.fullName);
    } else if (listKey === 'priorityLevels') {
      const clients = store.get('clients');
      affectedNames = clients
        .filter((c) => c.priorityLevel === value)
        .map((c) => c.fullName);
    } else if (listKey === 'clientStatusValues') {
      const clients = store.get('clients');
      affectedNames = clients
        .filter((c) => c.status === value)
        .map((c) => c.fullName);
    } else if (listKey === 'goalStatusValues') {
      const goals = store.get('goals');
      const clients = store.get('clients');
      const clientMap = new Map(clients.map((c) => [c.id, c.fullName]));
      affectedNames = goals
        .filter((g) => g.status === value)
        .map((g) => clientMap.get(g.clientId) ?? g.clientId);
    }

    // Requirement 17.5: warn if references exist and not yet confirmed
    if (affectedNames.length > 0 && options.confirmed !== true) {
      return {
        warning: true,
        count: affectedNames.length,
        affectedNames,
        listKey,
        value,
      };
    }

    // -----------------------------------------------------------------------
    // Confirmed deletion (or no references) — Requirement 17.6
    // -----------------------------------------------------------------------
    const legacy = `${value} (removed)`;

    // Remove item from the reference list
    settings[listKey] = list.filter((item) => item !== value);
    this.saveSettings(settings);

    // Replace occurrences in all referencing records
    if (listKey === 'commonHabits') {
      const assignments = store.get('habitAssignments');
      const updated = assignments.map((a) =>
        a.habitName === value ? { ...a, habitName: legacy } : a
      );
      store.set('habitAssignments', updated);
    } else if (listKey === 'supportStyles') {
      const clients = store.get('clients');
      const updated = clients.map((c) =>
        c.supportStyle === value ? { ...c, supportStyle: legacy } : c
      );
      store.set('clients', updated);
    } else if (listKey === 'priorityLevels') {
      const clients = store.get('clients');
      const updated = clients.map((c) =>
        c.priorityLevel === value ? { ...c, priorityLevel: legacy } : c
      );
      store.set('clients', updated);
    } else if (listKey === 'clientStatusValues') {
      const clients = store.get('clients');
      const updated = clients.map((c) =>
        c.status === value ? { ...c, status: legacy } : c
      );
      store.set('clients', updated);
    } else if (listKey === 'goalStatusValues') {
      const goals = store.get('goals');
      const updated = goals.map((g) =>
        g.status === value ? { ...g, status: legacy } : g
      );
      store.set('goals', updated);
    }

    return { success: true };
  },
};
