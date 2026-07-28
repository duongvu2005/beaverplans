import { percentOf } from '../core/math';
import type { SparkColumn } from './sparkColumns';
import styles from './WeekSpark.module.css';

type WeekSparkProps = {
    columns: ReadonlyArray<SparkColumn>;
    className?: string;
};

/**
 * A shape as bars: bar height is that column's assigned weight over the
 * busiest column shown, the inner fill is done over assigned. A light column
 * therefore reads as a short bar rather than a full-height empty one.
 *
 * What a column IS comes from the caller — days of one week, weekdays summed
 * across many, weights — so the chart stays one visual language at every scale.
 * Both percentages are relative to what was passed in, so a caller showing a
 * subset must truncate before rendering, never hide columns with CSS.
 *
 * Size is set by the caller through --spark-track-h and --spark-bar-w;
 * className is for the caller's own layout concerns (e.g. flex ordering).
 */
export function WeekSpark({ columns, className }: WeekSparkProps) {
    const maxAssigned = Math.max(1, ...columns.map((c) => c.assigned));

    return (
        <span className={className ? `${styles.spark} ${className}` : styles.spark}>
            {columns.map((column) => (
                <span key={column.key} className={styles.col}>
                    <span className={styles.barTrack}>
                        <span
                            className={styles.bar}
                            style={{ height: `${percentOf(column.assigned, maxAssigned)}%` }}
                        >
                            <i style={{ height: `${percentOf(column.done, column.assigned)}%` }} />
                        </span>
                    </span>
                    <span className={styles.lab}>{column.label}</span>
                </span>
            ))}
        </span>
    );
}
