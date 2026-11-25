import type { DateKey, Project } from '@/core/types';
import { ProjectList } from './ProjectList';
import type { TreeKeysApi } from './useTreeKeys';
import type { GuideApi } from './guide';
import { useCopy } from '@/i18n/localeContext';
import styles from './ProjectView.module.css';

type ProjectViewProps = {
    projects: ReadonlyArray<Project>;
    /** the Monday of the week on screen, and today — a deadline's tone needs both */
    weekStart: DateKey;
    today: DateKey;
    /** whether this week's board is frozen to edits (the week has ended) */
    readOnly?: boolean;
    treeKeys: TreeKeysApi;
    /** absent unless the onboarding guide is running — see GuideApi */
    guide?: GuideApi;
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
    onCopyPlan: () => void;
    onPastePlan: () => void;
};

export function ProjectView({
    readOnly = false,
    onCopyPlan,
    onPastePlan,
    ...props
}: ProjectViewProps) {
    const { projectView } = useCopy();
    return (
        <div className="projectView" inert={readOnly}>
            <div className={styles.head}>
                <span className={styles.eyebrow}>{projectView.eyebrow}</span>
                {/* Hidden on a frozen week. Muted while the guide is cueing. */}
                {!readOnly && (
                    <span className={props.guide ? `${styles.line} ${styles.quiet}` : styles.line}>
                        {/* Copy has no object with nothing on the board; paste
                            is live either way. */}
                        <button
                            type="button"
                            className={styles.link}
                            disabled={props.projects.length === 0}
                            onClick={onCopyPlan}
                        >
                            {projectView.copyPlan}
                        </button>
                        {' · '}
                        <button type="button" className={styles.link} onClick={onPastePlan}>
                            {projectView.pastePlan}
                        </button>
                    </span>
                )}
            </div>
            <ProjectList {...props} frozen={readOnly} />
        </div>
    );
}
