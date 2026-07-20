import { Dialog } from './Dialog';
import type { Task } from '../core/types';
import styles from './TaskEditor.module.css';
import { useState } from 'react';

type TaskEditorProps = {
    task: Task;
    projectName: string;
    onClose: () => void; // Cancel / scrim / Esc
    onSave: (nextTask: Task) => void; // Save
};

export function TaskEditor({ task, projectName, onClose, onSave }: TaskEditorProps) {
    const [draft, _setDraft] = useState<Task>(task);
    const titleId = 'task-editor-title';
    return (
        <Dialog open onClose={onClose} labelledBy={titleId}>
            <div className={styles.head}>
                <div className={styles.eyebrow}>{projectName || 'Project'}</div>
                <h3 id={titleId} className={styles.title}>
                    {task.name || 'Task'}
                </h3>
            </div>
            <div className={styles.body}>
                <p className={styles.empty}>Fields go here.</p>
            </div>
            <div className={styles.foot}>
                <button type="button" className={`${styles.btn} ${styles.ghost}`} onClick={onClose}>
                    Cancel
                </button>
                <button
                    type="button"
                    className={`${styles.btn} ${styles.primary}`}
                    onClick={() => onSave(draft)}
                >
                    Save
                </button>
            </div>
        </Dialog>
    );
}
