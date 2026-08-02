import type { Project } from '../core/types';
import { ProjectList } from './ProjectList';
import styles from './ProjectView.module.css';

type ProjectViewProps = {
    projects: ReadonlyArray<Project>;
    /** whether this week's board is frozen to edits (ended, or behind the archive bound) */
    readOnly?: boolean;
    onReorderProject: (projectId: string, beforeProjectId: string | null) => void;
    onReorderTask: (taskId: string, destProjectId: string, beforeTaskId: string | null) => void;
    onEditTask: (taskId: string) => void;
    onEditDeadline: (projectId: string) => void;
    onToggleTask: (taskId: string) => void;
    onAddProject: () => void;
    onAddTask: (projectId: string) => void;
    onRenameProject: (projectId: string, name: string) => void;
    onRenameTask: (taskId: string, name: string) => void;
    onRemoveProject: (projectId: string) => void;
    onRemoveTask: (taskId: string) => void;
};

export function ProjectView({ readOnly = false, ...props }: ProjectViewProps) {
    return (
        <div className="projectView" inert={readOnly}>
            <div className={styles.head}>
                <span className={styles.eyebrow}>Projects</span>
            </div>
            <ProjectList {...props} />
        </div>
    );
}
