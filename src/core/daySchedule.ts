import { dateKeyForDay, dayOfWeekOf } from './dates';
import { parseDeadline } from './deadline';
import { isProjectDone, isTaskDone } from './projects';
import type { DateKey, DayOfWeek, Project, Subtask } from './types';
import { WEEK } from './types';

export type DayEntry = {
    readonly subtask: Subtask;
    readonly taskName: string;
    readonly projectName: string;
};

export type DaySchedule = {
    readonly day: DayOfWeek;
    readonly items: ReadonlyArray<DayEntry>;
};

/**
 * Lay the week out by day: place every subtask on its assignedDay and on each of its
 * missedDays. Leaf tasks (no subtasks) are not scheduled.
 *
 * @param projects  a list of valid projects
 * @returns  7 DaySchedules, one per weekday in Mon→Sun order. Each day's items are the
 *           entries placed on it, in project → task → subtask order; empty days included.
 */
export function scheduleByDay(projects: ReadonlyArray<Project>): ReadonlyArray<DaySchedule> {
    return WEEK.map((day) => ({
        day,
        items: projects.flatMap((project) =>
            project.tasks.flatMap((task) =>
                task.subtasks
                    .filter((s) => s.assignedDay === day || s.missedDays.includes(day))
                    .map((s) => ({
                        subtask: s,
                        taskName: task.name,
                        projectName: project.name,
                    })),
            ),
        ),
    }));
}

/** One thing falling due on a given day, named so a client can list it. */
export type DueEntry = {
    readonly name: string;
    readonly kind: 'project' | 'task';
    readonly deadline: string;
};

export type DayDue = {
    readonly day: DayOfWeek;
    readonly entries: ReadonlyArray<DueEntry>;
};

/**
 * Lay the week out by day again, this time by what falls DUE on each one —
 * the companion to scheduleByDay, which lays out what is scheduled. The two
 * routinely disagree: a task due Wednesday whose only subtask sits on Thursday
 * appears on Wednesday here and on Thursday there.
 *
 * @param projects a list of valid projects
 * @param weekStart a DateKey that is a Monday (week-start)
 * @returns 7 DayDues, one per weekday in Mon→Sun order, empty days included.
 *          Each day's entries are those projects and tasks whose deadline parses
 *          and falls on that date, in project → task tree order, a project ahead
 *          of its own tasks. A project or task that is done, or whose stored
 *          deadline does not parse, contributes nothing.
 */
export function dueByDay(
    projects: ReadonlyArray<Project>,
    weekStart: DateKey,
): ReadonlyArray<DayDue> {
    const weekEnd = dateKeyForDay(weekStart, 'sun');
    const byDay: Record<DayOfWeek, DueEntry[]> = {
        mon: [],
        tue: [],
        wed: [],
        thu: [],
        fri: [],
        sat: [],
        sun: [],
    };

    // Adds one entry if its deadline is readable and lands in this week.
    function place(deadline: string | undefined, name: string, kind: DueEntry['kind']): void {
        if (deadline === undefined || !parseDeadline(deadline).ok) return;
        const dueDay = deadline.slice(0, 10);
        // DateKey is fixed-width, so string order is chronological order.
        if (dueDay < weekStart || dueDay > weekEnd) return;
        byDay[dayOfWeekOf(dueDay)].push({ name, kind, deadline });
    }

    for (const project of projects) {
        if (!isProjectDone(project)) {
            place(project.deadline, project.name, 'project');
        }
        for (const task of project.tasks) {
            if (!isTaskDone(task)) {
                place(task.deadline, task.name, 'task');
            }
        }
    }
    return WEEK.map((day) => ({ day, entries: byDay[day] }));
}
