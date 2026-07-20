import type { Project } from '../core/types';
import { ProjectCard } from './ProjectCard';
import styles from './ProjectList.module.css';

type ProjectListProps = {
    projects: ReadonlyArray<Project>;
    onEditTask: (taskId: string) => void;
    onToggleTask: (taskId: string) => void;
    onAddTask: (projectId: string) => void;
    onAddProject: () => void;
    onRenameProject: (projectId: string, name: string) => void;
    onRenameTask: (taskId: string, name: string) => void;
    onRemoveProject: (projectId: string) => void;
    onRemoveTask: (taskId: string) => void;
};

export function ProjectList({
    projects,
    onEditTask,
    onToggleTask,
    onAddTask,
    onAddProject,
    onRenameProject,
    onRenameTask,
    onRemoveProject,
    onRemoveTask,
}: ProjectListProps) {
    return (
        <div>
            {projects.map((project) => (
                <ProjectCard
                    key={project.id}
                    project={project}
                    onEditTask={onEditTask}
                    onToggleTask={onToggleTask}
                    onAddTask={onAddTask}
                    onRenameProject={onRenameProject}
                    onRenameTask={onRenameTask}
                    onRemoveProject={onRemoveProject}
                    onRemoveTask={onRemoveTask}
                />
            ))}
            <button type="button" className={styles.addProject} onClick={onAddProject}>
                + add project
            </button>
        </div>
    );
}
