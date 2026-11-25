import { monthAndDay } from '@/i18n/dateCopy';
import { useCopy, useLocale } from '@/i18n/localeContext';
import { percentOf } from '@/core/math';
import type { TrendItem } from '@/core/weekStats';
import spark from '@/components/shared/WeekSpark.module.css';
import styles from './WeekTrend.module.css';

/** Bar heights, as a percentage of the track, for the columns no week has reached yet. */
const PLACEHOLDER_HEIGHTS: readonly number[] = [
    68, 76, 84, 90, 86, 80, 74, 68, 64, 68, 74, 80, 86, 90, 94, 92,
];

type WeekTrendProps = {
    items: ReadonlyArray<TrendItem>;
    /** How many columns the chart has room for. Any left over after items are drawn as empty slots. */
    slots?: number;
};

/**
 * Archived weeks as bars, oldest first, with untracked stretches drawn as breaks
 * rather than closed up. Bar height is the week's size against the biggest week
 * SHOWN, so the caller must pass only the items it wants drawn.
 */
export function WeekTrend({ items, slots = 0 }: WeekTrendProps) {
    const { locale } = useLocale();
    const { weekTrend } = useCopy();
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
                                {weekTrend.gapWeeks(item.weeks)}
                                <br />
                                {weekTrend.gapNotTracked}
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
                        title={weekTrend.title(
                            monthAndDay(weekStart, locale),
                            progress.done,
                            progress.total,
                        )}
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
                        <span className={styles.label}>{monthAndDay(weekStart, locale)}</span>
                    </div>
                );
            })}
            {Array.from({ length: empty }, (_unused, index) => {
                const column = items.length + index;
                const height = PLACEHOLDER_HEIGHTS[column % PLACEHOLDER_HEIGHTS.length] ?? 50;
                return (
                    // The blank label lines are what make an empty column the
                    // same height as a week column.
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
