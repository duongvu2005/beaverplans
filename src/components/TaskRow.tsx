import { isTaskDone } from '../core/projects';
import type { Task } from '../core/types';
import { Grip } from './Grip';
import { EditIcon } from './EditIcon';
import { CloseIcon } from './CloseIcon';
import styles from './TaskRow.module.css';
import check from './checkbox.module.css';

type TaskRowProps = {
    task: Task;
    onToggleTask: (taskId: string) => void;
    onRenameTask: (taskId: string, name: string) => void;
    onRemoveTask: (taskId: string) => void;
};

export function TaskRow({ task, onToggleTask, onRenameTask, onRemoveTask }: TaskRowProps) {
    const undated = task.subtasks.length === 0;
    return (
        <li className={styles.row}>
            <Grip className={styles.grip} />
            <input
                type="checkbox"
                className={check.box}
                checked={isTaskDone(task)}
                onChange={() => onToggleTask(task.id)}
            />
            <input
                className={styles.name}
                value={task.name}
                placeholder="Task…"
                onChange={(e) => onRenameTask(task.id, e.target.value)}
            />
            {undated && (
                <button
                    type="button"
                    className={styles.assignHint}
                    title="Assign which days to do this"
                >
                    assign days
                    <span className={styles.arrow} aria-hidden="true">
                        →
                    </span>
                </button>
            )}
            <div className={styles.actions}>
                <button
                    type="button"
                    className={undated ? `${styles.iconBtn} ${styles.assignCta}` : styles.iconBtn}
                    aria-label="Edit task"
                    title="Assign days / split / deadline"
                >
                    <EditIcon />
                </button>
                <button
                    type="button"
                    className={styles.iconBtn}
                    aria-label="Delete task"
                    onClick={() => onRemoveTask(task.id)}
                >
                    <CloseIcon />
                </button>
            </div>
        </li>
    );
}
