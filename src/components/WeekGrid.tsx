import type { DateKey, DayOfWeek } from '../core/types';
import type { DaySchedule } from '../core/daySchedule';
import type { DayProgress } from '../core/progress';
import { DayColumn } from './DayColumn';
import styles from './WeekGrid.module.css';

type WeekGridProps = {
    schedule: ReadonlyArray<DaySchedule>;
    byDay: ReadonlyArray<DayProgress>;
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

export function WeekGrid({
    schedule,
    byDay,
    weekStart,
    today,
    ended,
    readOnly = false,
    onFocusDay,
    onToggleSubtask,
    onEditSubtask,
    onRequestMove,
    onClearMissed,
}: WeekGridProps) {
    return (
        <div className={styles.grid}>
            {schedule.map((daySchedule, i) => (
                <DayColumn
                    key={daySchedule.day}
                    daySchedule={daySchedule}
                    progress={byDay[i]}
                    weekStart={weekStart}
                    today={today}
                    ended={ended}
                    readOnly={readOnly}
                    onFocusDay={onFocusDay}
                    onToggleSubtask={onToggleSubtask}
                    onEditSubtask={onEditSubtask}
                    onRequestMove={onRequestMove}
                    onClearMissed={onClearMissed}
                />
            ))}
        </div>
    );
}
