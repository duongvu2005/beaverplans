import type { DaySchedule } from '../core/daySchedule';
import { DayCell } from './DayCell';
import styles from './DayColumn.module.css';

type DayColumnProps = {
    daySchedule: DaySchedule;
    onToggleSubtask: (subtaskId: string) => void;
};

export function DayColumn({ daySchedule, onToggleSubtask }: DayColumnProps) {
    return (
        <section className={styles.column}>
            <h4 className={styles.day}>{daySchedule.day}</h4>
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
