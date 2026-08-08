import { monthAndDay } from '@/core/dates';
import { percentOf } from '@/core/math';
import type { TrendItem } from '@/core/weekStats';
import spark from './WeekSpark.module.css';
import styles from './WeekTrend.module.css';

/**
 * Bar heights, as a percentage of the track, for the columns no week has reached
 * yet — an illustrative skyline so an empty chart shows the shape it is going to
 * take. Nothing is derived from it.
 *
 * Deliberately high and slow: it sits in the upper half of the track, because the
 * shape you are being shown is one worth aiming at, and it moves in one long
 * up-down-up rather than a sawtooth, so it reads as a horizon rather than as busy
 * fake data. Every value stays under 100 so the tallest bar on the chart is always
 * a real week.
 *
 * Indexed by a column's ABSOLUTE position, so the skyline stays put as weeks
 * accrue and real bars advance across it. Indexing by position within the empty
 * run would reshuffle the remaining placeholders every time a week was added.
 */
const PLACEHOLDER_HEIGHTS: readonly number[] = [
    68, 76, 84, 90, 86, 80, 74, 68, 64, 68, 74, 80, 86, 90, 94, 92,
];

type WeekTrendProps = {
    items: ReadonlyArray<TrendItem>;
    /**
     * How many columns the chart has room for — normally the same n that was
     * passed to weekTrend. Any left over after items are drawn as empty slots,
     * so a short history reads as a chart filling up rather than a chart with a
     * hole in it. Omit to draw only the items.
     */
    slots?: number;
};

/**
 * Archived weeks as bars, oldest first, with untracked stretches drawn as
 * breaks rather than closed up — so the chart never implies two weeks were
 * consecutive when they weren't.
 *
 * Bar height is the week's size against the biggest week SHOWN, and the fill
 * is how much of it was finished: WeekSpark's semantics with weeks in place of
 * days, and its bar recipe, at a taller scale. The normalisation is why the
 * caller must pass only the items it wants drawn — see weekTrend's n.
 *
 * Weeks fill from the left and the remaining slots stand empty to their right,
 * so as history accrues the real bars advance into the empty ones. Once there
 * are more weeks than slots, weekTrend has already truncated to the most recent
 * n and no slots are left over.
 */
export function WeekTrend({ items, slots = 0 }: WeekTrendProps) {
    const maxTotal = Math.max(
        1,
        ...items.map((item) => (item.kind === 'week' ? item.week.progress.total : 0)),
    );
    const empty = Math.max(0, slots - items.length);

    return (
        <div className={styles.trend}>
            {items.map((item, index) => {
                if (item.kind === 'gap') {
                    return (
                        <div key={`gap-${index}`} className={styles.brk} aria-hidden="true">
                            <span className={styles.rule} />
                            <span className={styles.brkText}>
                                {item.weeks} week{item.weeks === 1 ? '' : 's'}
                                <br />
                                not tracked
                            </span>
                        </div>
                    );
                }

                const { weekStart, progress } = item.week;
                const pct = Math.round(percentOf(progress.done, progress.total));
                return (
                    <div
                        key={weekStart}
                        className={styles.week}
                        title={`${monthAndDay(weekStart)}: ${progress.done}/${progress.total} units`}
                    >
                        <span className={spark.barTrack}>
                            <span
                                className={spark.bar}
                                style={{ height: `${percentOf(progress.total, maxTotal)}%` }}
                            >
                                <i style={{ height: `${pct}%` }} />
                            </span>
                        </span>
                        <span className={styles.pct}>{pct}%</span>
                        <span className={styles.label}>{monthAndDay(weekStart)}</span>
                    </div>
                );
            })}
            {Array.from({ length: empty }, (_unused, index) => {
                const column = items.length + index;
                const height = PLACEHOLDER_HEIGHTS[column % PLACEHOLDER_HEIGHTS.length] ?? 50;
                return (
                    // The two label lines are kept as blanks rather than dropped:
                    // they are what makes an empty column the same height as a week
                    // column, so every bar sits on one baseline.
                    <div key={`slot-${index}`} className={styles.slot} aria-hidden="true">
                        <span className={styles.slotTrack}>
                            <span className={styles.slotBar} style={{ height: `${height}%` }} />
                        </span>
                        <span className={styles.pct}>&nbsp;</span>
                        <span className={styles.label}>&nbsp;</span>
                    </div>
                );
            })}
        </div>
    );
}
