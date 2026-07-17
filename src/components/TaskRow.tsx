import { isTaskDone } from '../core/projects';
import type { Task } from '../core/types';

type TaskRowProps = {
    task: Task;
    onToggleTask: (taskId: string) => void;
};

export function TaskRow({ task, onToggleTask }: TaskRowProps) {
    return (
        <li>
            <input
                type="checkbox"
                checked={isTaskDone(task)}
                onChange={() => onToggleTask(task.id)}
            />
            {task.name}
        </li>
    );
}
