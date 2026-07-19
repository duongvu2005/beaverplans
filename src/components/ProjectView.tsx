import type { Project } from '../core/types';
import { ProjectList } from './ProjectList';

type ProjectViewProps = {
    projects: ReadonlyArray<Project>;
    onToggleTask: (taskId: string) => void;
    onAddProject: () => void;
    onAddTask: (projectId: string) => void;
    onRenameProject: (projectId: string, name: string) => void;
    onRenameTask: (taskId: string, name: string) => void;
    onRemoveProject: (projectId: string) => void;
    onRemoveTask: (taskId: string) => void;
};

export function ProjectView(props: ProjectViewProps) {
    return (
        <div className="projectView">
            <ProjectList {...props} />
        </div>
    );
}
