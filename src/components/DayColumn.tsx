import type { DaySchedule } from '../core/daySchedule';
import { DayCell } from './DayCell';

type DayColumnProps = {
    daySchedule: DaySchedule;
    onToggleSubtask: (subtaskId: string) => void;
};

export function DayColumn({ daySchedule, onToggleSubtask }: DayColumnProps) {
    return (
        <section>
            <h4>{daySchedule.day}</h4>
            <ul>
                {daySchedule.items.map((entry) => (
                    <DayCell
                        key={entry.subtask.id}
                        entry={entry}
                        isMissed={daySchedule.day !== entry.subtask.assignedDay}
                        onToggleSubtask={onToggleSubtask}
                    />
                ))}
            </ul>
        </section>
    );
}
