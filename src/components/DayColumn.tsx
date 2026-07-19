import type { DayOfWeek } from '../core/types';
import type { DaySchedule } from '../core/daySchedule';
import { DayCell } from './DayCell';
import styles from './DayColumn.module.css';

type DayColumnProps = {
    daySchedule: DaySchedule;
    onFocusDay: (day: DayOfWeek) => void;
    onToggleSubtask: (subtaskId: string) => void;
};

export function DayColumn({ daySchedule, onFocusDay, onToggleSubtask }: DayColumnProps) {
    return (
        <section className={styles.column}>
            <button
                type="button"
                className={styles.day}
                onClick={() => onFocusDay(daySchedule.day)}
                title="Focus this day"
            >
                {daySchedule.day}
            </button>
            <ul className={styles.list}>
                {daySchedule.items.map((entry) => (
                    <DayCell
                        key={entry.subtask.id}
                        entry={entry}
                        isMissed={daySchedule.day !== entry.subtask.assignedDay}
                        compact={true}
                        onToggleSubtask={onToggleSubtask}
                    />
                ))}
            </ul>
        </section>
    );
}
