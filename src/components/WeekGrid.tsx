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
