import { isTaskDone } from '../core/projects';
import type { Task } from '../core/types';
import styles from './TaskRow.module.css';
import check from './checkbox.module.css';

type TaskRowProps = {
    task: Task;
    onToggleTask: (taskId: string) => void;
};

export function TaskRow({ task, onToggleTask }: TaskRowProps) {
    return (
        <li className={styles.row}>
            <input
                type="checkbox"
                className={check.box}
                checked={isTaskDone(task)}
                onChange={() => onToggleTask(task.id)}
            />
            {task.name}
        </li>
    );
}
