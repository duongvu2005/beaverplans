import { dateKeyForDay } from "./dates";
import type { Archive, DateKey } from "./types";

/**
 * Completed weighted effort per calendar day, across every archived week.
 * The only consumer is the contribution heatmap, which needs a done count
 * per real date and never total/assigned — stays scoped to that.
 *
 * Only subtasks carry a weekday slot (assignedDay), so — same as
 * progress.ts's progressByDay — a leaf task's own isDone contributes
 * nothing here; it has no date to be credited to.
 *
 * @param archives any Archive
 * @returns a map from DateKey (a real calendar date, derived from an entry's
 *          weekStart plus the weekday a subtask was assigned to) to the
 *          total weighted effort completed on that date, summed across
 *          every archive entry whose week contains it. A date with nothing
 *          completed is absent from the map, not present with 0.
 */
export function dailyCompletions(archives: Archive): Map<DateKey, number> {
    const totals = new Map<DateKey, number>();
    for (const { weekStart, projects } of archives) {
        const subtasks = projects.flatMap((p) => p.tasks.flatMap((t) => t.subtasks));
        for (const subtask of subtasks) {
            if (!subtask.isDone) {
                continue;
            }
            const date = dateKeyForDay(weekStart, subtask.assignedDay);
            totals.set(date, (totals.get(date) ?? 0) + subtask.weight);
        }
    }
    return totals;
}
