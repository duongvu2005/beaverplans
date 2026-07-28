import type { Archive, DayOfWeek } from '../core/types';
import { todayKey, weekStartOf } from '../core/dates';
import { percentOf } from '../core/math';
import {
    bestWeek,
    currentStreak,
    dailyCompletions,
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

    // A real prop, not CSS-hidden columns: WeekTrend normalises bar height
    // against the biggest week SHOWN, so a hidden column could own the maximum.
    const items = weekTrend(history, wide ? TREND_ITEMS_WIDE : TREND_ITEMS_NARROW);

    const completions = dailyCompletions(archive);
    const scheduled = [...completions.values()].reduce((sum, count) => sum + count, 0);
    // Only subtasks carry a weekday, so a finished leaf task has no date to be
    // drawn on. Said out loud below rather than left to under-report quietly.
    const undated = pooledDone - scheduled;
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

    return (
        <div className={styles.board}>
            <div className={styles.head}>
                <span className={styles.count}>
                    {history.length} week{history.length === 1 ? '' : 's'} tracked
                </span>
            </div>

            <div className={styles.summary}>
                <div>
                    <span className={styles.big}>
                        {Math.round(percentOf(pooledDone, pooledTotal))}%
                    </span>
                    <span className={styles.statLabel}>Completed</span>
                </div>
                <div>
                    <span className={styles.big}>
                        {best === undefined
                            ? '—'
                            : `${Math.round(percentOf(best.progress.done, best.progress.total))}%`}
                    </span>
                    <span className={styles.statLabel}>Best week</span>
                </div>
                <div>
                    <span className={styles.big}>{currentStreak(history, STREAK_THRESHOLD)}</span>
                    <span className={styles.statLabel}>Streak</span>
                </div>
            </div>

            <section>
                <h3 className={styles.section}>Week by week</h3>
                <p className={styles.note}>
                    Bar height is the week&apos;s size; the fill is what you finished.
                </p>
                <WeekTrend items={items} />
            </section>

            <section>
                <div className={styles.sectionHead}>
                    <h3 className={styles.section}>Scheduled work</h3>
                    {wide && <HeatmapLegend />}
                </div>
                <p className={styles.note}>
                    {scheduled} unit{scheduled === 1 ? '' : 's'} completed on a scheduled day.
                    {undated > 0 &&
                        ` ${undated} more ${undated === 1 ? 'was' : 'were'} finished on undated tasks, which have no day to sit on.`}
                </p>
                <Heatmap columns={columns} />
                {!wide && (
                    <div className={styles.legendRow}>
                        <HeatmapLegend />
                    </div>
                )}
            </section>

            <section>
                <h3 className={styles.section}>By weekday</h3>
                {strongest !== undefined && (
                    <p className={styles.note}>
                        {DAY_NAME[strongest.day]} is your strongest day —{' '}
                        {Math.round(percentOf(strongest.done, strongest.assigned))}% of what you
                        plan there gets done.
                    </p>
                )}
                <WeekSpark className={styles.weekdays} columns={weekdayColumns(weekdays)} figures />
            </section>
        </div>
    );
}
