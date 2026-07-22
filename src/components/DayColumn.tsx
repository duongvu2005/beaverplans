import type { DateKey, DayOfWeek } from '../core/types';
import type { DaySchedule } from '../core/daySchedule';
import { DayCell } from './DayCell';
import styles from './DayColumn.module.css';

type DayColumnProps = {
    daySchedule: DaySchedule;
    weekStart: DateKey;
    today: DateKey;
    onFocusDay: (day: DayOfWeek) => void;
    onToggleSubtask: (subtaskId: string) => void;
    onEditSubtask: (subtaskId: string) => void;
    onRequestMove: (subtaskId: string) => void;
    onClearMissed: (subtaskId: string, day: DayOfWeek) => void;
};

export function DayColumn({
    daySchedule,
    weekStart,
    today,
    onFocusDay,
    onToggleSubtask,
    onEditSubtask,
    onRequestMove,
    onClearMissed,
}: DayColumnProps) {
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
                        day={daySchedule.day}
                        isMissed={daySchedule.day !== entry.subtask.assignedDay}
                        weekStart={weekStart}
                        today={today}
                        compact={true}
                        onToggleSubtask={onToggleSubtask}
                        onEditSubtask={onEditSubtask}
                        onRequestMove={onRequestMove}
                        onClearMissed={onClearMissed}
                    />
                ))}
            </ul>
        </section>
    );
}
