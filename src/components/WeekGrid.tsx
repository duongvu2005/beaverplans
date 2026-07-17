import type { Project } from '../core/types';
import { scheduleByDay } from '../core/daySchedule';
import { DayColumn } from './DayColumn';

type WeekGridProps = {
    projects: ReadonlyArray<Project>;
    onToggleSubtask: (subtaskId: string) => void;
};

export function WeekGrid({ projects, onToggleSubtask }: WeekGridProps) {
    const schedule = scheduleByDay(projects);
    return (
        <div>
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
