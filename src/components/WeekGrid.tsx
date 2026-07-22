import type { DateKey, DayOfWeek } from '../core/types';
import type { DaySchedule } from '../core/daySchedule';
import { DayColumn } from './DayColumn';
import styles from './WeekGrid.module.css';

type WeekGridProps = {
    schedule: ReadonlyArray<DaySchedule>;
    weekStart: DateKey;
    today: DateKey;
    onFocusDay: (day: DayOfWeek) => void;
    onToggleSubtask: (subtaskId: string) => void;
    onEditSubtask: (subtaskId: string) => void;
    onRequestMove: (subtaskId: string) => void;
    onClearMissed: (subtaskId: string, day: DayOfWeek) => void;
};

export function WeekGrid({
    schedule,
    weekStart,
    today,
    onFocusDay,
    onToggleSubtask,
    onEditSubtask,
    onRequestMove,
    onClearMissed,
}: WeekGridProps) {
    return (
        <div className={styles.grid}>
            {schedule.map((daySchedule) => (
                <DayColumn
                    key={daySchedule.day}
                    daySchedule={daySchedule}
                    weekStart={weekStart}
                    today={today}
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
