import type { Project } from '../core/types';
import { ProjectCard } from './ProjectCard';

type ProjectListProps = {
    projects: ReadonlyArray<Project>;
    onToggleTask: (taskId: string) => void;
};

export function ProjectList({ projects, onToggleTask }: ProjectListProps) {
    return (
        <div>
            {projects.map((project) => (
                <ProjectCard key={project.id} project={project} onToggleTask={onToggleTask} />
            ))}
        </div>
    );
}
