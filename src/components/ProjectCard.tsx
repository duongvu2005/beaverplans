import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Project } from '../core/types';
import { TaskRow } from './TaskRow';
import { Grip } from './Grip';
import { DeadlineIcon } from './DeadlineIcon';
import { CloseIcon } from './CloseIcon';
import styles from './ProjectCard.module.css';

type ProjectCardProps = {
    project: Project;
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
    onEditTask,
    onToggleTask,
    onAddTask,
    onRenameProject,
    onRenameTask,
    onRemoveProject,
    onRemoveTask,
}: ProjectCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: project.id, data: { type: 'project' } });
    // The task list is a drop target in its own right, so a task can be dropped
    // into a project that has no tasks yet, or onto the empty space at the end.
    const { setNodeRef: setListRef } = useDroppable({
        id: `list:${project.id}`,
        data: { type: 'list', projectId: project.id },
    });

    const style = { transform: CSS.Transform.toString(transform), transition };
    const taskIds = project.tasks.map((task) => task.id);

    return (
        <section
            ref={setNodeRef}
            style={style}
            className={isDragging ? `${styles.card} ${styles.dragging}` : styles.card}
        >
            <div className={styles.header}>
                <span
                    ref={setActivatorNodeRef}
                    className={styles.gripHandle}
                    title="Drag to reorder project"
                    aria-label="Drag to reorder project"
                    {...attributes}
                    {...listeners}
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
            <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
                <ul ref={setListRef} className={styles.list}>
                    {project.tasks.map((task) => (
                        <TaskRow
                            key={task.id}
                            task={task}
                            projectId={project.id}
                            onEditTask={onEditTask}
                            onToggleTask={onToggleTask}
                            onRenameTask={onRenameTask}
                            onRemoveTask={onRemoveTask}
                        />
                    ))}
                </ul>
            </SortableContext>
            <button type="button" className={styles.addTask} onClick={() => onAddTask(project.id)}>
                <span className={styles.spacer} />
                <span className={styles.plus}>+</span>
                add task
            </button>
        </section>
    );
}
