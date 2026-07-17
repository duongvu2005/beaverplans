import type { Project } from '../core/types';
import { TaskRow } from './TaskRow';

type ProjectCardProps = {
    project: Project;
    onToggleTask: (taskId: string) => void;
};

export function ProjectCard({ project, onToggleTask }: ProjectCardProps) {
    return (
        <section>
            <h3>{project.name}</h3>
            <ul>
                {project.tasks.map((task) => (
                    <TaskRow key={task.id} task={task} onToggleTask={onToggleTask} />
                ))}
            </ul>
        </section>
    );
}
