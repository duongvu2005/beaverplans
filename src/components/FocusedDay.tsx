import type { DayEntry } from '../core/daySchedule';
import type { DateKey, DayOfWeek } from '../core/types';
import { DayCell } from './DayCell';
import styles from './FocusedDay.module.css';

const NAME: Record<DayOfWeek, string> = {
    mon: 'Monday',
    tue: 'Tuesday',
    wed: 'Wednesday',
    thu: 'Thursday',
    fri: 'Friday',
    sat: 'Saturday',
    sun: 'Sunday',
};

type FocusedDayProps = {
    day: DayOfWeek;
    items: ReadonlyArray<DayEntry>;
    isToday: boolean;
    weekStart: DateKey;
    today: DateKey;
    onToggleSubtask: (subtaskId: string) => void;
    onEditSubtask: (subtaskId: string) => void;
    onRequestMove: (subtaskId: string) => void;
    onClearMissed: (subtaskId: string, day: DayOfWeek) => void;
};

export function FocusedDay({
    day,
    items,
    isToday,
    weekStart,
    today,
    onToggleSubtask,
    onEditSubtask,
    onRequestMove,
    onClearMissed,
}: FocusedDayProps) {
    const assigned = items.filter((entry) => entry.subtask.assignedDay === day);
    const doneCount = assigned.filter((entry) => entry.subtask.isDone).length;
    return (
        <div className={styles.card}>
            <p className={styles.head}>
                {NAME[day]}
                {isToday ? ' · today' : ''}
            </p>
            <p className={styles.count}>
                {items.length === 0
                    ? 'nothing scheduled'
                    : `${doneCount} of ${assigned.length} done`}
            </p>
            {items.length === 0 ? (
                <p className={styles.empty}>No tasks on this day.</p>
            ) : (
                <ul className={styles.list}>
                    {items.map((entry) => (
                        <DayCell
                            key={entry.subtask.id}
                            entry={entry}
                            day={day}
                            isMissed={entry.subtask.assignedDay !== day}
                            weekStart={weekStart}
                            today={today}
                            onToggleSubtask={onToggleSubtask}
                            onEditSubtask={onEditSubtask}
                            onRequestMove={onRequestMove}
                            onClearMissed={onClearMissed}
                        />
                    ))}
                </ul>
            )}
        </div>
    );
}
