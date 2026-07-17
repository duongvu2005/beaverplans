import type { Project } from '../core/types';
import { scheduleByDay } from '../core/daySchedule';
import { DayColumn } from './DayColumn';
import styles from './WeekGrid.module.css';

type WeekGridProps = {
    projects: ReadonlyArray<Project>;
    onToggleSubtask: (subtaskId: string) => void;
};

export function WeekGrid({ projects, onToggleSubtask }: WeekGridProps) {
    const schedule = scheduleByDay(projects);
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
