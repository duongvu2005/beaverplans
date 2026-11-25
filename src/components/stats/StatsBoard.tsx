import type { DateKey, Weeks } from '@/core/types';
import { todayKey, weekStartOf } from '@/core/dates';
import { percentOf } from '@/core/math';
import {
    bestWeek,
    currentStreak,
    dailyCompletions,
    longestStreak,
    weekHistory,
    weekTrend,
    weekdayHistory,
} from '@/core/weekStats';
import { WeekSpark } from '@/components/shared/WeekSpark';
import { weekdayColumns } from '@/components/shared/sparkColumns';
import { WeekTrend } from './WeekTrend';
import { WeekRef } from '@/components/shared/WeekRef';
import { Heatmap, HeatmapLegend } from './Heatmap';
import { heatColumns } from './heatColumns';
import { DESKTOP_MIN_WIDTH, useContainerWidth } from '@/hooks/useContainerWidth';
import styles from './StatsBoard.module.css';
import { dayName } from '@/i18n/dateCopy';
import { useCopy, useLocale } from '@/i18n/localeContext';

/** A week counts toward the streak at half its planned weight or better. */
const STREAK_THRESHOLD = 50;

/** Trend columns: about four months of weeks on desktop, two on a phone. */
const TREND_ITEMS_WIDE = 16;
const TREND_ITEMS_NARROW = 8;

type StatsBoardProps = {
    archive: Weeks;
    /** show the named week on the Plan tab; the caller switches tabs too */
    onOpenWeek: (weekStart: DateKey) => void;
};

/** Everything the ended weeks add up to. Derived entirely from the archive; the live week never appears. */
export function StatsBoard({ archive, onOpenWeek }: StatsBoardProps) {
    const { locale } = useLocale();
    const { statsBoard } = useCopy();
    // Same box and same number as the stylesheet's `@container app (min-width:
    // 681px)`, so the item count and the CSS layout cannot drift apart.
    const [boardRef, containerWidth] = useContainerWidth<HTMLDivElement>();
    const wide = containerWidth !== null && containerWidth >= DESKTOP_MIN_WIDTH;
    const history = weekHistory(archive);

    if (history.length === 0) {
        return (
            <div className={styles.board} ref={boardRef}>
                <div className={styles.empty}>
                    <p className={styles.emptyTitle}>{statsBoard.emptyTitle}</p>
                    <p className={styles.emptyText}>{statsBoard.emptyText}</p>
                </div>
            </div>
        );
    }

    // Pooled, not the mean of per-week percentages.
    const pooledDone = history.reduce((sum, week) => sum + week.progress.done, 0);
    const pooledTotal = history.reduce((sum, week) => sum + week.progress.total, 0);
    // bestWeek answers undefined only for an empty history, and the guard above
    // has already returned on that — so this is an invariant, not a hope.
    const best = bestWeek(history)!;
    const streak = currentStreak(history, STREAK_THRESHOLD);
    const longest = longestStreak(history, STREAK_THRESHOLD);

    // A real prop, not CSS-hidden columns: WeekTrend normalises bar height
    // against the biggest week SHOWN, so a hidden column could own the maximum.
    const items = weekTrend(history, wide ? TREND_ITEMS_WIDE : TREND_ITEMS_NARROW);

    const completions = dailyCompletions(archive);
    // What the grid holds, not everything finished: only subtasks carry a
    // weekday, so a finished leaf task is not counted here either.
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

    const byWeekday = weekdayColumns(weekdays, locale);
    // Where finished work landed: each weekday's share of everything completed,
    // so the seven figures add up to 100%.
    const finishedOnDays = weekdays.reduce((sum, day) => sum + day.done, 0);
    const distribution = byWeekday.map((column) => ({
        ...column,
        assigned: column.done,
    }));
    // Every bar full height, so only the fill differs.
    const followed = byWeekday.map((column) => ({
        ...column,
        assigned: 100,
        done: Math.round(percentOf(column.done, column.assigned)),
    }));

    return (
        <div className={styles.board} ref={boardRef}>
            <div className={styles.stats}>
                <div className={styles.stat}>
                    <span className={styles.big}>
                        {Math.round(percentOf(pooledDone, pooledTotal))}%
                    </span>
                    <span className={styles.statLabel}>{statsBoard.avgCompletion}</span>
                    <span className={styles.statSub}>
                        {statsBoard.ofTaskUnits(pooledDone, pooledTotal)}
                    </span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.big}>
                        {Math.round(percentOf(best.progress.done, best.progress.total))}%
                    </span>
                    <span className={styles.statLabel}>{statsBoard.bestWeek}</span>
                    <span className={styles.statSub}>
                        <WeekRef weekStart={best.weekStart} onView={onOpenWeek} />
                    </span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.big}>{streak}</span>
                    <span className={styles.statLabel}>{statsBoard.weekStreak}</span>
                    <span className={styles.statSub}>
                        {streak > 0
                            ? statsBoard.inARowAt(STREAK_THRESHOLD)
                            : longest > 0
                              ? statsBoard.bestRunWas(longest)
                              : statsBoard.noStreak}
                    </span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.big}>{history.length}</span>
                    <span className={styles.statLabel}>{statsBoard.weeksTracked}</span>
                    <span className={styles.statSub}>{statsBoard.allTime}</span>
                </div>
            </div>

            <section className={styles.card}>
                <h3 className={styles.section}>{statsBoard.weekByWeek}</h3>
                <p className={styles.note}>{statsBoard.weekByWeekNote}</p>
                <WeekTrend items={items} slots={wide ? TREND_ITEMS_WIDE : TREND_ITEMS_NARROW} />
            </section>

            <section className={styles.card}>
                <div className={styles.sectionHead}>
                    <h3 className={styles.section}>{statsBoard.activity}</h3>
                    <HeatmapLegend />
                </div>
                <p className={styles.note}>{statsBoard.activityNote(scheduled)}</p>
                <Heatmap columns={columns} className={styles.heatmap} />
            </section>

            <section className={styles.card}>
                <h3 className={styles.section}>{statsBoard.followThrough}</h3>
                <p className={styles.note}>
                    {strongest === undefined
                        ? statsBoard.followThroughNote
                        : statsBoard.strongestDay(
                              dayName(strongest.day, locale, 'long'),
                              Math.round(percentOf(strongest.done, strongest.assigned)),
                          )}
                </p>
                <WeekSpark className={styles.weekdays} columns={followed} figures />
            </section>

            <section className={styles.card}>
                <h3 className={styles.section}>{statsBoard.distribution}</h3>
                <p className={styles.note}>
                    {biggestShare === undefined
                        ? statsBoard.distributionNote
                        : statsBoard.busiestDay(
                              dayName(biggestShare.day, locale, 'long'),
                              Math.round(percentOf(biggestShare.done, finishedOnDays)),
                          )}
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
