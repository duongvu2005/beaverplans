import type { DayEntry } from '../core/daySchedule';
import check from './checkbox.module.css';
import styles from './DayCell.module.css';

type DayCellProps = {
    entry: DayEntry;
    isMissed: boolean;
    compact?: boolean;
    onToggleSubtask: (subtaskId: string) => void;
    onEditSubtask: (subtaskId: string) => void;
};

export function DayCell({
    entry,
    isMissed,
    compact = false,
    onToggleSubtask,
    onEditSubtask,
}: DayCellProps) {
    const { subtask, taskName, projectName } = entry;
    const cellClass = [
        styles.cell,
        compact && styles.compact,
        subtask.isDone && !isMissed && styles.done,
        isMissed && styles.missed,
    ]
        .filter(Boolean)
        .join(' ');
    return (
        <li className={cellClass}>
            <input
                type="checkbox"
                className={isMissed ? `${check.box} ${styles.missedCheck}` : check.box}
                checked={subtask.isDone && !isMissed}
                disabled={isMissed}
                onChange={() => onToggleSubtask(subtask.id)}
            />
            <div className={styles.text} onClick={() => onEditSubtask(subtask.id)}>
                <div className={styles.eyebrow}>
                    <span className={styles.project}>{projectName}</span>
                    <span className={styles.weight} aria-label={`weight ${subtask.weight} of 3`}>
                        {[1, 2, 3].map((n) => (
                            <span
                                key={n}
                                className={
                                    n <= subtask.weight ? `${styles.pip} ${styles.on}` : styles.pip
                                }
                            />
                        ))}
                    </span>
                </div>
                <div className={styles.task}>{taskName}</div>
                {subtask.description && <span className={styles.desc}>{subtask.description}</span>}
                {isMissed && <span className={styles.missTag}>missed</span>}
            </div>
        </li>
    );
}
