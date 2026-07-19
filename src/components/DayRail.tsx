import type { DayOfWeek, Project } from '../core/types';
import { progressByDay } from '../core/progress';
import { percentOf } from '../core/math';
import { dayStatusOf, todayKey } from '../core/dates';
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
    projects: ReadonlyArray<Project>;
    weekStart: string;
    selectedDay: DayOfWeek;
    onSelectDay: (day: DayOfWeek) => void;
};

export function DayRail({ projects, weekStart, selectedDay, onSelectDay }: DayRailProps) {
    const byDay = progressByDay(projects);
    const today = todayKey();
    return (
        <div className={styles.rail}>
            {byDay.map(({ day, assigned, done }) => {
                const pct = percentOf(done, assigned);
                const classes = [
                    styles.pill,
                    dayStatusOf(day, weekStart, today) === 'today' && styles.today,
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
                        onClick={() => onSelectDay(day)}
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
