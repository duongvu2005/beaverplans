import type { DateKey, DayOfWeek } from '../core/types';
import type { DaySchedule } from '../core/daySchedule';
import type { DayProgress } from '../core/progress';
import { DayCell } from './DayCell';
import { PointsStat } from './PointsStat';
import styles from './DayColumn.module.css';

type DayColumnProps = {
    daySchedule: DaySchedule;
    progress: DayProgress | undefined;
    weekStart: DateKey;
    today: DateKey;
    /** whether this week has been ended, and so is a frozen record */
    ended: boolean;
    /** whether this week's board is frozen to edits (ended, or behind the archive bound) */
    readOnly?: boolean;
    onFocusDay: (day: DayOfWeek) => void;
    onToggleSubtask: (subtaskId: string) => void;
    onEditSubtask: (subtaskId: string) => void;
    onRequestMove: (subtaskId: string) => void;
    onClearMissed: (subtaskId: string, day: DayOfWeek) => void;
};

export function DayColumn({
    daySchedule,
    progress,
    weekStart,
    today,
    ended,
    readOnly = false,
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
                <span className={styles.dayName}>{daySchedule.day}</span>
                <PointsStat done={progress?.done ?? 0} total={progress?.assigned ?? 0} showPoint={true} />
            </button>
            {/* inert on the list only, not the day button above: viewing which
                day has what is navigation, not an edit, and should still work
                on a frozen week. */}
            <ul className={styles.list} inert={readOnly}>
                {daySchedule.items.map((entry) => (
                    <DayCell
                        key={entry.subtask.id}
                        entry={entry}
                        day={daySchedule.day}
                        isMissed={daySchedule.day !== entry.subtask.assignedDay}
                        weekStart={weekStart}
                        today={today}
                        ended={ended}
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
