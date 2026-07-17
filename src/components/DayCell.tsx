import type { DayEntry } from '../core/daySchedule';
import check from './checkbox.module.css';
import styles from './DayCell.module.css';

type DayCellProps = {
    entry: DayEntry;
    isMissed: boolean;
    onToggleSubtask: (subtaskId: string) => void;
};

export function DayCell({ entry, isMissed, onToggleSubtask }: DayCellProps) {
    return (
        <li className={styles.cell}>
            <input
                type="checkbox"
                className={check.box}
                checked={entry.subtask.isDone && !isMissed}
                disabled={isMissed}
                onChange={() => onToggleSubtask(entry.subtask.id)}
            />
            <div className={styles.text}>
                <span className={styles.project}>{entry.projectName}</span>
                <span className={styles.task}>{entry.taskName}</span>
            </div>
        </li>
    );
}
