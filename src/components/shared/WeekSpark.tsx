import { percentOf } from '@/core/math';
import { useCopy } from '@/i18n/localeContext';
import type { SparkColumn } from './sparkColumns';
import styles from './WeekSpark.module.css';

type WeekSparkProps = {
    columns: ReadonlyArray<SparkColumn>;
    className?: string;
    /** Print a figure under each column's label. */
    figures?: boolean;
    /** What that figure says. Defaults to the column's completion. */
    figureOf?: (column: SparkColumn) => string;
};

/**
 * A shape as bars: bar height is the column's assigned weight over the busiest
 * column shown, the inner fill is done over assigned.
 */
export function WeekSpark({
    columns,
    className,
    figures = false,
    figureOf = (column) => `${Math.round(percentOf(column.done, column.assigned))}%`,
}: WeekSparkProps) {
    const { weekSpark } = useCopy();
    const maxAssigned = Math.max(1, ...columns.map((c) => c.assigned));

    return (
        <span className={className ? `${styles.spark} ${className}` : styles.spark}>
            {columns.map((column) => (
                <span
                    key={column.key}
                    className={styles.col}
                    title={weekSpark.title(column.done, column.assigned)}
                >
                    <span className={styles.barTrack}>
                        <span
                            className={[
                                styles.bar,
                                column.unlived ? styles.unlived : '',
                                column.unlived && column.done > 0 ? styles.unlivedDone : '',
                            ].join(' ')}
                            style={{ height: `${percentOf(column.assigned, maxAssigned)}%` }}
                        >
                            <i style={{ height: `${percentOf(column.done, column.assigned)}%` }} />
                        </span>
                    </span>
                    <span className={`${styles.lab} ${column.isToday ? styles.today : ''}`}>
                        {column.label}
                    </span>
                    {figures && (
                        <span
                            className={`${styles.fig} ${column.assigned === 0 ? styles.zero : ''}`}
                        >
                            {figureOf(column)}
                        </span>
                    )}
                </span>
            ))}
        </span>
    );
}
