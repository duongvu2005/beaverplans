import { monthAndDay } from '../core/dates';
import { percentOf } from '../core/math';
import type { TrendItem } from '../core/archiveStats';
import spark from './WeekSpark.module.css';
import styles from './WeekTrend.module.css';

type WeekTrendProps = {
    items: ReadonlyArray<TrendItem>;
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
 */
export function WeekTrend({ items }: WeekTrendProps) {
    const maxTotal = Math.max(
        1,
        ...items.map((item) => (item.kind === 'week' ? item.week.progress.total : 0)),
    );

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
        </div>
    );
}
