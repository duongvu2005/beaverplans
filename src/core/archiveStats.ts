import { dateKeyForDay } from "./dates";
import { overallProgress, progressByDay } from "./progress";
import type { Progress, DayProgress } from "./progress";
import type { Archive, DateKey, DayOfWeek } from "./types";
import { WEEK } from "./types";

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

export type WeekProgress = {
    readonly weekStart: DateKey;
    readonly progress: Progress;
};

/**
 * The overall progress of every archived week, one entry per week.
 *
 * @param archives any Archive
 * @returns a list with one entry per entry in archives, each pairing that
 *          entry's weekStart with overallProgress(projects) computed fresh
 *          on its snapshot, sorted chronologically by weekStart (ascending,
 *          oldest first)
 */
export function weekHistory(archives: Archive): ReadonlyArray<WeekProgress> {
    return archives
        .map(({ weekStart, projects }) => ({ weekStart, progress: overallProgress(projects) }))
        .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

/**
 * The progress of each weekday slot (mon-sun), summed across every
 * archived week. Distinct from progress.ts's progressByDay, which is
 * per-day within a single week; this aggregates that same slot (e.g.
 * every archived Wednesday) across all of archives.
 *
 * @param archives any Archive
 * @returns a list of DayProgress, one per weekday, ordered Monday first
 *          through Sunday last (length 7). For each, assigned and done
 *          are the sum of that weekday's assigned/done (per
 *          progress.ts's progressByDay, computed fresh per entry) across
 *          every entry in archives.
 */
export function weekdayHistory(archives: Archive): ReadonlyArray<DayProgress> {
    const totals: Record<DayOfWeek, { assigned: number; done: number }> = {
        mon: { assigned: 0, done: 0 },
        tue: { assigned: 0, done: 0 },
        wed: { assigned: 0, done: 0 },
        thu: { assigned: 0, done: 0 },
        fri: { assigned: 0, done: 0 },
        sat: { assigned: 0, done: 0 },
        sun: { assigned: 0, done: 0 },
    };
    for (const { projects } of archives) {
        for (const dayProgress of progressByDay(projects)) {
            totals[dayProgress.day].assigned += dayProgress.assigned;
            totals[dayProgress.day].done += dayProgress.done;
        }
    }
    return WEEK.map((day) => ({ day, ...totals[day] }));
}
