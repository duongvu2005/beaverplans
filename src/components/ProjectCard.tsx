import type { Project } from '../core/types';
import { TaskRow } from './TaskRow';
import { Grip } from './Grip';
import { DeadlineIcon } from './DeadlineIcon';
import { CloseIcon } from './CloseIcon';
import styles from './ProjectCard.module.css';

type ProjectCardProps = {
    project: Project;
    onToggleTask: (taskId: string) => void;
    onAddTask: (projectId: string) => void;
    onRenameProject: (projectId: string, name: string) => void;
    onRenameTask: (taskId: string, name: string) => void;
    onRemoveProject: (projectId: string) => void;
    onRemoveTask: (taskId: string) => void;
};

export function ProjectCard({
    project,
    onToggleTask,
    onAddTask,
    onRenameProject,
    onRenameTask,
    onRemoveProject,
    onRemoveTask,
}: ProjectCardProps) {
    return (
        <section className={styles.card}>
            <div className={styles.header}>
                <Grip className={styles.grip} />
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
            <ul className={styles.list}>
                {project.tasks.map((task) => (
                    <TaskRow
                        key={task.id}
                        task={task}
                        onToggleTask={onToggleTask}
                        onRenameTask={onRenameTask}
                        onRemoveTask={onRemoveTask}
                    />
                ))}
            </ul>
            <button type="button" className={styles.addTask} onClick={() => onAddTask(project.id)}>
                <span className={styles.spacer} />
                <span className={styles.plus}>+</span>
                add task
            </button>
        </section>
    );
}
