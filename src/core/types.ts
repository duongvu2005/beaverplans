export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type DateKey = string; // YYYY-MM-DD
export type DayStatus = 'past' | 'today' | 'future';
export type WeekStatus = 'past' | 'current' | 'future';

export const WEEK: readonly DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export type Project = {
    readonly id: string;
    readonly name: string;
    readonly tasks: ReadonlyArray<Task>;
    readonly deadline?: string;
};

export type Task = {
    readonly id: string;
    readonly name: string;
    readonly isDone?: boolean; // only need this if task has no subtask
    readonly subtasks: ReadonlyArray<Subtask>;
    readonly deadline?: string;
    readonly description?: string;
};

export type Subtask = {
    readonly id: string;
    readonly isDone: boolean;
    readonly assignedDay: DayOfWeek;
    readonly missedDays: ReadonlyArray<DayOfWeek>;
    readonly weight: number;
    readonly description?: string;
};

/**
 * A plan for a single Monday-to-Sunday week: an ordered list of projects for
 * the week that begins on `weekStart`.
 *
 * Abstraction function:
 *   AF(weekStart, projects) = the plan for the 7-day week beginning on the
 *   Monday `weekStart`, containing the projects in the given order. Each project
 *   holds an ordered list of tasks; each task is carried out through its
 *   subtasks (or, if it has none, is a single leaf item that is done or not).
 *   Within the week, each subtask is scheduled on weekday `assignedDay` and
 *   recorded as missed on each weekday in `missedDays`.
 *
 * Rep invariant:
 *   - weekStart is a well-formed DateKey (local YYYY-MM-DD) AND is a Monday.
 *   - every id across all projects, tasks, and subtasks is globally unique.
 *   - every project is well-formed: isValidProject -> isValidTask ->
 *     isValidSubtask (e.g. a subtask's weight is 1..3 and its missedDays all fall
 *     strictly before its assignedDay in weekday order; a task carries isDone only
 *     when it is a leaf).
 *   checkRep = isValidPlan (see projects.ts), which tests this whole invariant.
 *   It is asserted on producer outputs in tests, never called on production paths.
 *
 * Safety from rep exposure:
 *   - both fields are readonly; projects is a ReadonlyArray and every nested
 *     Project/Task/Subtask is readonly with ReadonlyArray children, so the rep
 *     is deeply immutable and weekStart is an immutable string.
 *   - producers never mutate their input; they return a new WeekPlan and may
 *     structurally share unchanged subtrees. Sharing is safe precisely because
 *     shared nodes are deeply immutable: no client can mutate one to break
 *     either plan's RI. Observers may hand back references into the rep, but
 *     those references are readonly, so clients cannot mutate through them.
 *   - note: WeekPlan is a public structural type, not an encapsulated rep, so a
 *     client could construct an invalid literal directly. The RI is therefore one
 *     the producers maintain and the tests assert (via isValidPlan), not one the
 *     type system enforces.
 */
export type WeekPlan = {
    readonly weekStart: DateKey;
    readonly projects: ReadonlyArray<Project>;
};

export type Archive = ReadonlyArray<WeekPlan>;
