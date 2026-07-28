import type { DayOfWeek } from '../core/types';
import type { DayProgress } from '../core/progress';
import { percentOf } from '../core/math';
import styles from './WeekSpark.module.css';

const LETTER: Record<DayOfWeek, string> = {
    mon: 'M',
    tue: 'T',
    wed: 'W',
    thu: 'T',
    fri: 'F',
    sat: 'S',
    sun: 'S',
};

type WeekSparkProps = {
    days: ReadonlyArray<DayProgress>;
    className?: string;
};

/**
 * A week's day shape as seven bars: bar height is that day's assigned weight
 * over the week's busiest day, the inner fill is done over assigned. A light
 * day therefore reads as a short bar rather than a full-height empty one.
 *
 * Size is set by the caller through --spark-track-h and --spark-bar-w;
 * className is for the caller's own layout concerns (e.g. flex ordering).
 */
export function WeekSpark({ days, className }: WeekSparkProps) {
    const maxAssigned = Math.max(1, ...days.map((d) => d.assigned));

    return (
        <span className={className ? `${styles.spark} ${className}` : styles.spark}>
            {days.map((day) => (
                <span key={day.day} className={styles.col}>
                    <span className={styles.barTrack}>
                        <span
                            className={styles.bar}
                            style={{ height: `${percentOf(day.assigned, maxAssigned)}%` }}
                        >
                            <i style={{ height: `${percentOf(day.done, day.assigned)}%` }} />
                        </span>
                    </span>
                    <span className={styles.lab}>{LETTER[day.day]}</span>
                </span>
            ))}
        </span>
    );
}
