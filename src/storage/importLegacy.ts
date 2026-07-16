/**
 * One-shot importer: the old planner's persisted blob -> beaverplans
 * WeekPlan + Archive. Run once on an exported blob; NOT part of the live
 * load path (nothing in storage/ imports this).
 *
 * ── Old data format (the contract these converters assume) ──
 *
 * Row: { tasks, archives, week_start }
 *   tasks       the live week's projects (the "project tree" below)
 *   archives    past weeks
 *   week_start  the live week's Monday as a local 'YYYY-MM-DD' (already clean)
 *
 * Project tree (used by both `tasks` and each archive's `snapshot`):
 *   project { id, title, deadline, subs }                -> a Project
 *   sub     { id, title, desc, done, deadline, slots }   -> a Task
 *   slot    { day, done, missed, desc? }                 -> a Subtask
 *
 * Assumed invariants:
 *   - day / missed entries are weekday keys 'mon'..'sun'.
 *   - slot.missed has no duplicates and does not contain slot.day.
 *   - a slot has no id and no weight; multiple slots may share a day.
 *   - sub.done matters only for a leaf sub (no slots); with slots, doneness
 *     is derived, so sub.done is dropped.
 *   - deadline is string | null; null means "no deadline" and is dropped.
 *
 * Archive entry: { start, snapshot, ...stats }
 *   snapshot   the project tree for that week
 *   start      the week's Monday, saved as toISOString() of a LOCAL-midnight
 *              Monday (mondayOf + setHours(0,0,0,0)). toISOString drops the
 *              origin timezone, but since it was exactly local midnight the
 *              instant is within ~14h of the Monday, so in ANY timezone it
 *              reads as that Monday or the Sunday before it. weekStartFromIso
 *              turns it back into the Monday DateKey.
 *   stats      perDay / label / doneCount / overallPct / totalCount / end are
 *              DERIVED in beaverplans, so they are ignored on import.
 *
 * Ids: every new node gets a fresh id via the injected newId(); old ids are
 * ignored (slots never had one), which guarantees the uniqueness RI.
 */

import type { Subtask, Task, Project, WeekPlan, Archive, DateKey, DayOfWeek} from "../core/types";
import { toDateKey } from "../core/dates";


// can be mapped to a Subtask in beaverplans
export type LegacySlot = {
    day: string;
    done: boolean;
    missed: string[];
    desc?: string;
};

// can be mapped to a Task in beaverplans
export type LegacySub = {
    id: string;
    title: string;
    desc: string;   
    done: boolean;  // only keep this if the old sub has no slot
    deadline: string | null;
    slots: LegacySlot[];
};

// can be mapped to a Project in beaverplans
export type LegacyTask = {
    id: string;
    title: string;
    deadline: string | null;
    subs: LegacySub[];
};

// can be mapped to a WeekPlan in beaverplans
export type LegacyArchive = {
    start: string;
    snapshot: LegacyTask[];
};

// data storage format of the (old) planner
export type LegacyRow = {
    tasks: LegacyTask[];
    archives: LegacyArchive[];
    week_start: string;  // start of the current active week
};


// --- tree converters (pure given newId) ---
/**
 * Convert a slot from the old planner into a beaverplans Subtask.
 *
 * @param slot  a slot from the old planner
 * @param newId supplies a fresh id for every node in the resulting plan
 *              (each project, task, and subtask). See module doc
 * @returns a Subtask with:
 *          - id = newId()
 *          - assignedDay = slot.day
 *          - isDone = slot.done
 *          - weight = 1
 *          - missedDays = slot.missed
 *          - description = slot.desc if non-empty (else omitted)
 */
export function toSubtask(slot: LegacySlot, newId: () => string): Subtask {
    return {
        id: newId(),
        assignedDay: slot.day as DayOfWeek,
        isDone: slot.done,
        weight: 1,
        missedDays: slot.missed as DayOfWeek[],
        ...(slot.desc ? { description: slot.desc } : {}),
    };
}

/**
 * Convert a sub from the old planner into a beaverplans Task.
 *
 * @param sub   a sub from the old planner
 * @param newId supplies a fresh id for every node in the resulting plan
 *              (each project, task, and subtask). See module doc
 * @returns a Task with:
 *          - id = newId()
 *          - name = sub.title
 *          - isDone = sub.done if sub.slots empty (else omitted)
 *          - subtasks: sub.slots with each slot converted to a subtask
 *          - deadline = sub.deadline if non-empty (else omitted)
 *          - description = sub.desc if non-empty (else omitted)
 */
export function toTask(sub: LegacySub, newId: () => string): Task {
    return {
        id: newId(),
        name: sub.title,
        ...(!sub.slots.length ? { isDone: sub.done } : {}),
        subtasks: sub.slots.map(slot => toSubtask(slot, newId)),
        ...(sub.deadline ? { deadline: sub.deadline } : {}),
        ...(sub.desc ? { description: sub.desc } : {}),
    };
}

/**
 * Convert a task from the old planner into a beaverplans Project.
 * 
 * @param task   a task from the old planner
 * @param newId  called once for every node produced — the project, each of
 *               its tasks, and each of their subtasks — supplying all their ids
 * @returns a Project with:
 *          - id = newId()
 *          - name = task.title
 *          - tasks = task.subs with each sub converted to a task
 *          - deadline = task.deadline if non-empty (else omitted)
 */
export function toProject(task: LegacyTask, newId: () => string): Project {
    return {
        id: newId(),
        name: task.title,
        tasks: task.subs.map(sub => toTask(sub, newId)),
        ...(task.deadline ? { deadline: task.deadline }: {})
    }
}

// --- weekStart recovery (pure) ---
/**
 * Turn an archive `start` into its week-start Monday DateKey (see the module
 * doc for how `start` was saved and why it reads as Sunday or Monday). Reads
 * the instant's local weekday and snaps a Sunday forward to that Monday; a
 * Monday already is the answer, so the result is the same in any timezone.
 * Assumes the instant reads as Sun/Mon locally (true for your archives).
 *
 * @param iso  an archive `start`: a UTC ISO instant, a local-midnight Monday.
 * @returns the DateKey (local YYYY-MM-DD) of that Monday.
 */
export function weekStartFromIso(iso: string): DateKey {
    // timezone ranges from UTC-12 to UTC+14, so a 12am Monday anywhere
    // in UTC time can be from a Sunday 10am to a Monday 12pm
    const SUNDAY = 0
    const date = new Date(iso);
    const offset = (date.getDay() === SUNDAY) ? 1 : 0;
    return toDateKey(
        new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate() + offset
        )
    );
}

// --- WeekPlan builders (pure given newId) ---
/**
 * Convert the curent active plan in the old planner to a beaverplans WeekPlan.
 * 
 * @param tasks the list of (old) active tasks
 * @param weekStart the row's week_start (see module doc)
 * @param newId  supplies a fresh id for every node in the resulting plan
 *               (each project, task, and subtask). See module doc.
 * @returns a WeekPlan with:
 *          - weekStart: weekStart,
 *          - projects: tasks with each task converted to a project
 */
export function activeToWeekPlan(tasks: LegacyTask[], weekStart: string, newId: () => string): WeekPlan {
    return {
        weekStart,
        projects: tasks.map(task => toProject(task, newId))
    };
}

/**
 * Convert an archive entry in the old planner to a beaverplans WeekPlan.
 * 
 * @param archive an (old) archive entry
 * @param newId supplies a fresh id for every node in the resulting plan
 *              (each project, task, and subtask). See module doc.
 * @returns a WeekPlan with:
 *          - weekStart: weekStart: weekStartFromIso(archive.start)
 *          - projects: snapshot with each task converted to a project
 */
export function archiveToWeekPlan(archive: LegacyArchive, newId: () => string): WeekPlan {
    return {
        weekStart: weekStartFromIso(archive.start),
        projects: archive.snapshot.map(task => toProject(task, newId))
    };
}

// --- top-level entry (impure: mints ids) ---
/**
 * Convert one persisted old-planner row (see module doc) into the new format:
 * the live week as a WeekPlan and the past weeks as an Archive.
 *
 * Not deterministic unless newId is supplied — the default mints random UUIDs.
 *
 * @param row    the old planner's persisted row { tasks, archives, week_start }.
 * @param newId  id source for every node produced — the live plan and every
 *               archived week. Defaults to crypto.randomUUID; pass a
 *               deterministic generator to test. See module doc.
 * @returns { plan, archive } where
 *          - plan    = the live week (row.tasks + row.week_start)
 *          - archive = row.archives, each converted to a WeekPlan, in order
 */
export function importLegacy(row: LegacyRow, newId?: () => string): { plan: WeekPlan; archive: Archive } {
    if (!newId) {
        newId = () => crypto.randomUUID();
    }
    return {
        plan: activeToWeekPlan(row.tasks, row.week_start, newId),
        archive: row.archives.map(archive => archiveToWeekPlan(archive, newId))
    };
}
