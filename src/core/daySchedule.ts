import type { DayOfWeek, Project, Subtask } from './types';
import { WEEK } from './types';

export type DayEntry = {
    readonly subtask: Subtask;
    readonly taskName: string;
    readonly projectName: string;
};

export type DaySchedule = {
    readonly day: DayOfWeek;
    items: ReadonlyArray<DayEntry>;
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
