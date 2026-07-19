import type { DaySchedule } from '../core/daySchedule';
import { DayColumn } from './DayColumn';
import styles from './WeekGrid.module.css';

type WeekGridProps = {
    schedule: ReadonlyArray<DaySchedule>;
    onToggleSubtask: (subtaskId: string) => void;
};

export function WeekGrid({ schedule, onToggleSubtask }: WeekGridProps) {
    return (
        <div className={styles.grid}>
            {schedule.map((daySchedule) => (
                <DayColumn
                    key={daySchedule.day}
                    daySchedule={daySchedule}
                    onToggleSubtask={onToggleSubtask}
                />
            ))}
        </div>
    );
}
