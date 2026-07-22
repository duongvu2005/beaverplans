import type { Project } from '../core/types';
import { TaskRow } from './TaskRow';
import { Grip } from './Grip';
import { DeadlineIcon } from './DeadlineIcon';
import { CloseIcon } from './CloseIcon';
import type { TreeDnd } from './useTreeDnd';
import styles from './ProjectCard.module.css';

type ProjectCardProps = {
    project: Project;
    dnd: TreeDnd;
    onEditTask: (taskId: string) => void;
    onToggleTask: (taskId: string) => void;
    onAddTask: (projectId: string) => void;
    onRenameProject: (projectId: string, name: string) => void;
    onRenameTask: (taskId: string, name: string) => void;
    onRemoveProject: (projectId: string) => void;
    onRemoveTask: (taskId: string) => void;
};

export function ProjectCard({
    project,
    dnd,
    onEditTask,
    onToggleTask,
    onAddTask,
    onRenameProject,
    onRenameTask,
    onRemoveProject,
    onRemoveTask,
}: ProjectCardProps) {
    const { hint, draggingId } = dnd;
    const isProjectHint = hint?.kind === 'project' && hint.id === project.id;
    const cardClass = [
        styles.card,
        draggingId === project.id && styles.dragging,
        isProjectHint && hint.pos === 'before' && styles.dropBefore,
        isProjectHint && hint.pos === 'after' && styles.dropAfter,
    ]
        .filter(Boolean)
        .join(' ');
    // a dragged task is over this card but not over a row: it lands at the end
    const dropAtEnd = hint?.kind === 'taskEnd' && hint.projectId === project.id;

    return (
        <section
            className={cardClass}
            data-drag-row
            onDragOver={(e) => dnd.overProject(e, project.id)}
            onDrop={(e) => dnd.dropProject(e, project.id)}
        >
            <div className={styles.header}>
                <span
                    className={styles.gripHandle}
                    draggable
                    onDragStart={(e) => dnd.startProject(e, project.id)}
                    onDragEnd={dnd.end}
                    title="Drag to reorder project"
                    aria-label="Drag to reorder project"
                >
                    <Grip className={styles.grip} />
                </span>
                <input
                    className={styles.name}
                    value={project.name}
                    placeholder="Project name…"
                    onChange={(e) => onRenameProject(project.id, e.target.value)}
                />
                <div className={styles.actions}>
                    <button
                        type="button"
                        className={styles.iconBtn}
                        aria-label="Set deadline"
                        title="Set deadline"
                    >
                        <DeadlineIcon />
                    </button>
                    <button
                        type="button"
                        className={styles.iconBtn}
                        aria-label="Delete project"
                        onClick={() => onRemoveProject(project.id)}
                    >
                        <CloseIcon />
                    </button>
                </div>
            </div>
            <ul
                className={dropAtEnd ? `${styles.list} ${styles.dropEnd}` : styles.list}
                onDragOver={(e) => dnd.overTaskList(e, project.id)}
                onDrop={(e) => dnd.dropTaskList(e, project.id)}
            >
                {project.tasks.map((task) => (
                    <TaskRow
                        key={task.id}
                        task={task}
                        projectId={project.id}
                        dnd={dnd}
                        onEditTask={onEditTask}
                        onToggleTask={onToggleTask}
                        onRenameTask={onRenameTask}
                        onRemoveTask={onRemoveTask}
                    />
                ))}
            </ul>
            <button
                type="button"
                className={styles.addTask}
                onClick={() => onAddTask(project.id)}
            >
                <span className={styles.spacer} />
                <span className={styles.plus}>+</span>
                add task
            </button>
        </section>
    );
}
