import { isTaskDone } from '../core/projects';
import type { Task } from '../core/types';
import { Grip } from './Grip';
import { EditIcon } from './EditIcon';
import { CloseIcon } from './CloseIcon';
import type { TreeDnd } from './useTreeDnd';
import styles from './TaskRow.module.css';
import check from './checkbox.module.css';

type TaskRowProps = {
    task: Task;
    projectId: string;
    dnd: TreeDnd;
    onEditTask: (taskId: string) => void;
    onToggleTask: (taskId: string) => void;
    onRenameTask: (taskId: string, name: string) => void;
    onRemoveTask: (taskId: string) => void;
};

export function TaskRow({
    task,
    projectId,
    dnd,
    onEditTask,
    onToggleTask,
    onRenameTask,
    onRemoveTask,
}: TaskRowProps) {
    const { hint, draggingId } = dnd;
    const isTaskHint = hint?.kind === 'task' && hint.id === task.id;
    const rowClass = [
        styles.row,
        draggingId === task.id && styles.dragging,
        isTaskHint && hint.pos === 'before' && styles.dropBefore,
        isTaskHint && hint.pos === 'after' && styles.dropAfter,
    ]
        .filter(Boolean)
        .join(' ');
    const undated = task.subtasks.length === 0;

    return (
        <li
            className={rowClass}
            data-drag-row
            onDragOver={(e) => dnd.overTask(e, task.id)}
            onDrop={(e) => dnd.dropTask(e, projectId, task.id)}
        >
            <span
                className={styles.gripHandle}
                draggable
                onDragStart={(e) => dnd.startTask(e, task.id)}
                onDragEnd={dnd.end}
                title="Drag to reorder, or move to another project"
                aria-label="Drag to reorder task"
            >
                <Grip className={styles.grip} />
            </span>
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
                    onClick={() => onEditTask(task.id)}
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
