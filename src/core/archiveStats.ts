import { dateKeyForDay } from "./dates";
import { percentOf } from "./math";
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

/**
 * The best-performing archived week, by completion percentage.
 *
 * @param history a chronological per-week progress history (see weekHistory)
 * @returns the entry in history with the highest percentOf(done, total); on
 *          a tie, the entry with the latest weekStart (a tie reads as a new
 *          record, not a repeat of the old one). undefined if history is
 *          empty.
 */
export function bestWeek(history: ReadonlyArray<WeekProgress>): WeekProgress | undefined {
    return history.reduce<WeekProgress | undefined>((best, entry) => {
        if (best === undefined) {
            return entry;
        }
        const entryPct = percentOf(entry.progress.done, entry.progress.total);
        const bestPct = percentOf(best.progress.done, best.progress.total);
        // >= (not >): history is chronological, so a tie keeps the later entry.
        return entryPct >= bestPct ? entry : best;
    }, undefined);
}

/**
 * The length of the current run of archived weeks meeting a completion
 * threshold, counted backward from the most recent week.
 *
 * @param history a chronological per-week progress history (see weekHistory)
 * @param threshold the minimum completion percentage (0-100) for a week to
 *        count toward the streak
 * @returns the number of weeks, counting backward from the end of history,
 *          that each have percentOf(done, total) >= threshold, stopping at
 *          the first (most recent) week that doesn't. 0 if history is empty
 *          or its last week doesn't meet threshold.
 */
export function currentStreak(history: ReadonlyArray<WeekProgress>, threshold: number): number {
    let streak = 0;
    for (const entry of [...history].reverse()) {
        if (percentOf(entry.progress.done, entry.progress.total) < threshold) {
            break;
        }
        streak++;
    }
    return streak;
}

/**
 * The longest run, anywhere in history, of consecutive archived weeks each
 * meeting a completion threshold.
 *
 * @param history a chronological per-week progress history (see weekHistory)
 * @param threshold the minimum completion percentage (0-100) for a week to
 *        count toward a streak
 * @returns the length of the longest run of consecutive entries (in
 *          chronological order) each with percentOf(done, total) >=
 *          threshold, anywhere in history. 0 if history is empty or no week
 *          meets threshold.
 */
export function longestStreak(history: ReadonlyArray<WeekProgress>, threshold: number): number {
    let longest = 0;
    let current = 0;
    for (const entry of history) {
        if (percentOf(entry.progress.done, entry.progress.total) >= threshold) {
            current++;
            longest = Math.max(longest, current);
        } else {
            current = 0;
        }
    }
    return longest;
}
