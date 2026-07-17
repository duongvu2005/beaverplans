import type { Project } from '../core/types';
import { TaskRow } from './TaskRow';
import styles from './ProjectCard.module.css';

type ProjectCardProps = {
    project: Project;
    onToggleTask: (taskId: string) => void;
};

export function ProjectCard({ project, onToggleTask }: ProjectCardProps) {
    return (
        <section className={styles.card}>
            <h3 className={styles.name}>{project.name}</h3>
            <ul>
                {project.tasks.map((task) => (
                    <TaskRow key={task.id} task={task} onToggleTask={onToggleTask} />
                ))}
            </ul>
        </section>
    );
}
