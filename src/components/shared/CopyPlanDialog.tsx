import { useState } from 'react';
import type { Project } from '@/core/types';
import { useCopy } from '@/i18n/localeContext';
import { ConfirmDialog } from './ConfirmDialog';
import shell from './dialogShell.module.css';
import check from './checkbox.module.css';
import styles from './CopyPlanDialog.module.css';

type CopyPlanDialogProps = {
    /** the projects on offer, in the order they should copy */
    projects: ReadonlyArray<Project>;
    eyebrow: string;
    title: string;
    onClose: () => void;
    // Receives the chosen projects in the order given, never the ids.
    onCopy: (projects: ReadonlyArray<Project>) => void;
};

/** Picks which projects to copy. Everything starts selected. */
export function CopyPlanDialog({ projects, eyebrow, title, onClose, onCopy }: CopyPlanDialogProps) {
    const { copyPlanDialog } = useCopy();
    const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());

    const chosen = projects.filter((project) => !excluded.has(project.id));

    const allChosen = excluded.size === 0;

    function toggle(projectId: string) {
        setExcluded((current) => {
            const next = new Set(current);
            if (!next.delete(projectId)) next.add(projectId);
            return next;
        });
    }

    function toggleAll() {
        setExcluded(allChosen ? new Set(projects.map((p) => p.id)) : new Set());
    }

    return (
        <ConfirmDialog
            eyebrow={eyebrow}
            title={title}
            onClose={onClose}
            actions={[
                {
                    label: copyPlanDialog.copy,
                    onAction: () => onCopy(chosen),
                    disabled: chosen.length === 0,
                },
            ]}
        >
            {projects.length === 0 ? (
                <p className={shell.text}>{copyPlanDialog.empty}</p>
            ) : (
                <>
                    <div className={styles.head}>
                        <span className={shell.label}>{copyPlanDialog.projects}</span>
                        <button type="button" className={styles.toggleAll} onClick={toggleAll}>
                            {allChosen ? copyPlanDialog.deselectAll : copyPlanDialog.selectAll}
                        </button>
                    </div>
                    <ul className={styles.list}>
                        {projects.map((project) => {
                            const tasks = copyPlanDialog.taskCount(project.tasks.length);
                            return (
                                <li key={project.id} className={styles.item}>
                                    <label className={styles.row}>
                                        <input
                                            type="checkbox"
                                            className={`${check.box} ${styles.pick}`}
                                            aria-label={copyPlanDialog.projectLabel(
                                                project.name,
                                                tasks,
                                            )}
                                            checked={!excluded.has(project.id)}
                                            onChange={() => toggle(project.id)}
                                        />
                                        <span className={styles.name}>{project.name}</span>
                                        <span className={styles.count}>{tasks}</span>
                                    </label>
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
        </ConfirmDialog>
    );
}
