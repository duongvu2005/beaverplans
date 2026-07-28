import { useState } from 'react';
import type { Project, WeekPlan } from '../core/types';
import { ConfirmDialog } from './ConfirmDialog';
import shell from './dialogShell.module.css';
import check from './checkbox.module.css';
import styles from './CopyWeekDialog.module.css';

type CopyWeekDialogProps = {
    entry: WeekPlan;
    label: string;
    onClose: () => void;
    // Receives the chosen projects in the week's own order, never the ids —
    // the caller serializes what it is handed and needs no second lookup.
    onCopy: (projects: ReadonlyArray<Project>) => void;
};

/**
 * Picks which of an archived week's projects to copy.
 *
 * Everything starts selected: copying the whole week is the common case, and
 * unchecking is a shorter path to "just this one" than checking three would be.
 */
export function CopyWeekDialog({ entry, label, onClose, onCopy }: CopyWeekDialogProps) {
    const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());

    // Tracking exclusions rather than inclusions keeps "all selected" as the
    // empty set, so the initial state needs no seeding from entry.projects.
    const chosen = entry.projects.filter((project) => !excluded.has(project.id));

    const allChosen = excluded.size === 0;

    function toggle(projectId: string) {
        setExcluded((current) => {
            const next = new Set(current);
            if (!next.delete(projectId)) next.add(projectId);
            return next;
        });
    }

    // One control that flips meaning rather than two, one of which would always
    // be a no-op: with everything on, only "none" is a move, and vice versa.
    function toggleAll() {
        setExcluded(allChosen ? new Set(entry.projects.map((p) => p.id)) : new Set());
    }

    return (
        <ConfirmDialog
            eyebrow="Archive"
            title={`Copy ${label}`}
            onClose={onClose}
            actions={[
                {
                    label: 'Copy',
                    onAction: () => onCopy(chosen),
                    disabled: chosen.length === 0,
                },
            ]}
        >
            {entry.projects.length === 0 ? (
                <p className={shell.text}>This week has no projects to copy.</p>
            ) : (
                <>
                    <div className={styles.head}>
                        <span className={shell.label}>Projects</span>
                        <button type="button" className={styles.toggleAll} onClick={toggleAll}>
                            {allChosen ? 'Deselect all' : 'Select all'}
                        </button>
                    </div>
                    <ul className={styles.list}>
                        {entry.projects.map((project) => {
                            const tasks = `${project.tasks.length} task${project.tasks.length === 1 ? '' : 's'}`;
                            return (
                                <li key={project.id} className={styles.item}>
                                    <label className={styles.row}>
                                        {/* Named explicitly: the two spans sit
                                            flush in the DOM (their gap is CSS),
                                            so the label's own text would compute
                                            to "beaverplans1 task". */}
                                        <input
                                            type="checkbox"
                                            className={check.box}
                                            aria-label={`${project.name}, ${tasks}`}
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
