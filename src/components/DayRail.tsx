import type { DayOfWeek } from '../core/types';
import type { DayProgress } from '../core/progress';
import { percentOf } from '../core/math';
import styles from './DayRail.module.css';

const LETTER: Record<DayOfWeek, string> = {
    mon: 'M',
    tue: 'T',
    wed: 'W',
    thu: 'T',
    fri: 'F',
    sat: 'S',
    sun: 'S',
};

type DayRailProps = {
    byDay: ReadonlyArray<DayProgress>;
    selectedDay: DayOfWeek;
    todayDay: DayOfWeek | undefined;
    onSelectDay: (day: DayOfWeek) => void;
    onBackToGrid: () => void;
};

export function DayRail({ byDay, selectedDay, todayDay, onSelectDay, onBackToGrid }: DayRailProps) {
    return (
        <div className={styles.rail}>
            {byDay.map(({ day, assigned, done }) => {
                const pct = percentOf(done, assigned);
                const classes = [
                    styles.pill,
                    day === todayDay && styles.today,
                    day === selectedDay && styles.selected,
                ]
                    .filter(Boolean)
                    .join(' ');
                return (
                    <button
                        key={day}
                        type="button"
                        className={classes}
                        aria-pressed={day === selectedDay}
                        onClick={() => (day === selectedDay ? onBackToGrid() : onSelectDay(day))}
                    >
                        <span className={styles.letter}>{LETTER[day]}</span>
                        <span className={styles.bar}>
                            <span className={styles.fill} style={{ width: `${pct}%` }} />
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
