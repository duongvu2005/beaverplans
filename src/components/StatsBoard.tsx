import type { Archive, DayOfWeek } from '../core/types';
import { todayKey, weekRangeLabel, weekStartOf } from '../core/dates';
import { percentOf } from '../core/math';
import {
    bestWeek,
    currentStreak,
    dailyCompletions,
    longestStreak,
    weekHistory,
    weekTrend,
    weekdayHistory,
} from '../core/archiveStats';
import { WeekSpark } from './WeekSpark';
import { weekdayColumns } from './sparkColumns';
import { WeekTrend } from './WeekTrend';
import { Heatmap, HeatmapLegend } from './Heatmap';
import { heatColumns } from './heatColumns';
import { useMediaQuery } from './useMediaQuery';
import styles from './StatsBoard.module.css';

/** A week counts toward the streak at half its planned weight or better. */
const STREAK_THRESHOLD = 50;

/** Trend columns: about four months of weeks on desktop, two on a phone. */
const TREND_ITEMS_WIDE = 16;
const TREND_ITEMS_NARROW = 8;

const DAY_NAME: Record<DayOfWeek, string> = {
    mon: 'Monday',
    tue: 'Tuesday',
    wed: 'Wednesday',
    thu: 'Thursday',
    fri: 'Friday',
    sat: 'Saturday',
    sun: 'Sunday',
};

type StatsBoardProps = {
    archive: Archive;
};

/**
 * Everything the ended weeks add up to: a summary, the week-by-week trend, a
 * year of scheduled work, and which weekdays actually deliver.
 *
 * Derived entirely from the archive — the live week has not been measured yet
 * and never appears here.
 */
export function StatsBoard({ archive }: StatsBoardProps) {
    const wide = useMediaQuery('(min-width: 641px)');
    const history = weekHistory(archive);

    if (history.length === 0) {
        return (
            <div className={styles.board}>
                <div className={styles.empty}>
                    <p className={styles.emptyTitle}>Nothing to measure yet</p>
                    <p className={styles.emptyText}>
                        Stats are built from ended weeks. End your first week on the Plan tab and
                        this fills in.
                    </p>
                </div>
            </div>
        );
    }

    // Pooled, not the mean of per-week percentages: averaging percentages
    // weighs a 2-unit break week the same as a 16-unit finals week.
    const pooledDone = history.reduce((sum, week) => sum + week.progress.done, 0);
    const pooledTotal = history.reduce((sum, week) => sum + week.progress.total, 0);
    const best = bestWeek(history);
    const streak = currentStreak(history, STREAK_THRESHOLD);
    const longest = longestStreak(history, STREAK_THRESHOLD);

    // A real prop, not CSS-hidden columns: WeekTrend normalises bar height
    // against the biggest week SHOWN, so a hidden column could own the maximum.
    const items = weekTrend(history, wide ? TREND_ITEMS_WIDE : TREND_ITEMS_NARROW);

    const completions = dailyCompletions(archive);
    // What the grid actually holds, not everything finished: only subtasks
    // carry a weekday, so a finished leaf task has no date to be drawn on and
    // is not counted here either. The caption stays true to the chart.
    const scheduled = [...completions.values()].reduce((sum, count) => sum + count, 0);
    const columns = heatColumns(
        completions,
        new Set(history.map((week) => week.weekStart)),
        weekStartOf(new Date()),
        todayKey(),
    );

    const weekdays = weekdayHistory(archive);
    const strongest = weekdays
        .filter((day) => day.assigned > 0)
        .reduce<(typeof weekdays)[number] | undefined>(
            (leader, day) =>
                leader === undefined ||
                percentOf(day.done, day.assigned) > percentOf(leader.done, leader.assigned)
                    ? day
                    : leader,
            undefined,
        );
    const biggestShare = weekdays
        .filter((day) => day.done > 0)
        .reduce<(typeof weekdays)[number] | undefined>(
            (leader, day) => (leader === undefined || day.done > leader.done ? day : leader),
            undefined,
        );

    const byWeekday = weekdayColumns(weekdays);
    // Where finished work landed: each weekday's share of everything completed,
    // so the seven figures add up to 100%. Solid bars — there is no second
    // quantity to show inside them, unlike the follow-through chart.
    const finishedOnDays = weekdays.reduce((sum, day) => sum + day.done, 0);
    const distribution = byWeekday.map((column) => ({
        ...column,
        assigned: column.done,
    }));
    // Every bar full height so only the fill differs — the point is comparing
    // rates across days, which unequal heights make harder, not easier.
    const followed = byWeekday.map((column) => ({
        ...column,
        assigned: 100,
        done: Math.round(percentOf(column.done, column.assigned)),
    }));

    return (
        <div className={styles.board}>
            <div className={styles.stats}>
                <div className={styles.stat}>
                    <span className={styles.big}>
                        {Math.round(percentOf(pooledDone, pooledTotal))}%
                    </span>
                    <span className={styles.statLabel}>Avg completion</span>
                    <span className={styles.statSub}>
                        {pooledDone} of {pooledTotal} task unit{pooledTotal === 1 ? '' : 's'} done
                    </span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.big}>
                        {best === undefined
                            ? '—'
                            : `${Math.round(percentOf(best.progress.done, best.progress.total))}%`}
                    </span>
                    <span className={styles.statLabel}>Best week</span>
                    <span className={styles.statSub}>
                        {best === undefined ? 'no data' : weekRangeLabel(best.weekStart)}
                    </span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.big}>{streak}</span>
                    <span className={styles.statLabel}>Week streak</span>
                    <span className={styles.statSub}>
                        {streak > 0
                            ? 'in a row at 50%+'
                            : longest > 0
                              ? `best run was ${longest}`
                              : 'no streak yet'}
                    </span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.big}>{history.length}</span>
                    <span className={styles.statLabel}>Weeks tracked</span>
                    <span className={styles.statSub}>all-time</span>
                </div>
            </div>

            <section className={styles.card}>
                <h3 className={styles.section}>Week by week</h3>
                <p className={styles.note}>
                    Bar height is the week&apos;s workload; the fill is what you completed.
                </p>
                <WeekTrend items={items} />
            </section>

            <section className={styles.card}>
                <div className={styles.sectionHead}>
                    <h3 className={styles.section}>Activity</h3>
                    <HeatmapLegend />
                </div>
                <p className={styles.note}>
                    {scheduled} task unit{scheduled === 1 ? '' : 's'} completed in the last year
                </p>
                <Heatmap columns={columns} className={styles.heatmap} />
            </section>

            <section className={styles.card}>
                <h3 className={styles.section}>Follow-through</h3>
                <p className={styles.note}>
                    {strongest === undefined
                        ? 'How much of each weekday you finish.'
                        : `${DAY_NAME[strongest.day]} is your strongest day — ${Math.round(percentOf(strongest.done, strongest.assigned))}% of what you plan there gets done.`}
                </p>
                <WeekSpark className={styles.weekdays} columns={followed} figures />
            </section>

            <section className={styles.card}>
                <h3 className={styles.section}>Distribution</h3>
                <p className={styles.note}>
                    {biggestShare === undefined
                        ? "Where each weekday's finished work lands."
                        : `${DAY_NAME[biggestShare.day]} is your busiest day — ${Math.round(percentOf(biggestShare.done, finishedOnDays))}% of everything you complete lands there.`}
                </p>
                <WeekSpark
                    className={`${styles.weekdays} ${styles.distribution}`}
                    columns={distribution}
                    figures
                    figureOf={(column) => `${Math.round(percentOf(column.done, finishedOnDays))}%`}
                />
            </section>
        </div>
    );
}
