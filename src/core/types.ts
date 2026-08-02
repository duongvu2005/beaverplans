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
 *   recorded as missed on each weekday in `missedDays`. `ended` says the week has
 *   been closed out and belongs to the archive; absent means it has not.
 *
 * Rep invariant:
 *   - weekStart is a well-formed DateKey (local YYYY-MM-DD) AND is a Monday.
 *   - every id across this plan's projects, tasks, and subtasks is unique. Weeks
 *     strengthens this: an id identifies one node across every week, not one per week.
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
    /** whether this week has been ended; absent means it has not */
    readonly ended?: boolean;
};

/**
 * Every week the planner knows about — past, present and future alike, active
 * weeks and ended ones together, at most one entry per week.
 *
 * Abstraction function:
 *   AF(weeks) = the partial function from a week-start Monday to the plan for that
 *   week, defined exactly on the weekStarts present in weeks. A week with no entry
 *   has no work, which is indistinguishable from an entry holding no projects — so
 *   no such entry is ever stored, and stepping onto an untouched week leaves no
 *   trace. The entries with ended = true are the archive; the rest are the active
 *   weeks.
 *
 * Rep invariant:
 *   - strictly increasing by weekStart: weeks[i-1].weekStart < weeks[i].weekStart
 *     for every adjacent pair. This carries both the ordering and the absence of
 *     duplicate weekStarts, and DateKey's fixed-width YYYY-MM-DD shape makes the
 *     string comparison agree with chronological order.
 *   - no entry is empty: every entry has at least one project.
 *   - every entry satisfies isValidPlan.
 *   - every id is unique across ALL entries: a project, task, or subtask id
 *     identifies one node in the whole collection, not one node per week. Stronger
 *     than isValidPlan's per-plan uniqueness, and it is what makes combining two
 *     weeks' work a plain concatenation — two weeks provably share no nodes —
 *     leaving merge needed only where two independently-created histories collide
 *     (guest -> cloud).
 *   Ended and active entries may interleave freely: an ended week's position among
 *   the others carries no meaning beyond its own weekStart. A week you forgot to
 *   plan does not become unreachable just because later weeks have already been
 *   archived — moveWeek and canEndWeek both act on one entry at a time and neither
 *   consults where the archive sits.
 *   checkRep = isValidWeeks (see weeks.ts), which also validates untrusted JSON on
 *   the storage read path.
 *
 * Ended weeks are frozen. Once ended, an entry is never edited, never relabelled
 * and never un-ended: putWeek refuses to write over one, moveWeek refuses one as
 * either endpoint, and there is no unlock. removeWeek may still discard one whole —
 * discarding is not editing. So an ended entry is the record of what that week
 * actually looked like, and carryForward copies out of it rather than emptying it.
 *
 * One further invariant the producers maintain, which the rep cannot state because
 * it needs the clock: every ended week has weekStart no later than the current
 * week. endWeek is the only way to create an ended entry and requires it; nothing
 * can move or edit an entry afterward; and the current week only advances, so once
 * true of an entry it stays true. It is asserted in tests rather than checked in
 * isValidWeeks, so that a skewed device clock cannot reject a valid stored
 * collection on the storage read path.
 *
 * Safety from rep exposure:
 *   - a ReadonlyArray of deeply immutable WeekPlans, so the whole rep is immutable
 *     and observers may hand back references into it safely.
 *   - producers return a new array and share unchanged entries by reference, which
 *     is safe for the same reason it is safe within a WeekPlan.
 *   - like WeekPlan, this is a public structural type rather than an encapsulated
 *     rep: the RI is one the producers maintain and the tests assert.
 */
export type Weeks = ReadonlyArray<WeekPlan>;

/** @deprecated use Weeks. Remaining consumers migrate file by file. */
export type Archive = ReadonlyArray<WeekPlan>;
