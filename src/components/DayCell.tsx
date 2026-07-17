import type { DayEntry } from '../core/daySchedule';

type DayCellProps = {
    entry: DayEntry;
    isMissed: boolean;
    onToggleSubtask: (subtaskId: string) => void;
};

export function DayCell({ entry, isMissed, onToggleSubtask }: DayCellProps) {
    return (
        <li>
            <input
                type="checkbox"
                checked={entry.subtask.isDone}
                disabled={isMissed}
                onChange={() => onToggleSubtask(entry.subtask.id)}
            />
            <span>{entry.projectName}</span>
            <span>{entry.taskName}</span>
        </li>
    );
}
