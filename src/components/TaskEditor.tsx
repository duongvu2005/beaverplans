import { Dialog } from './Dialog';
import type { Task } from '../core/types';
import styles from './TaskEditor.module.css';

type TaskEditorProps = {
    task: Task;
    projectName: string;
    onClose: () => void;
};

export function TaskEditor({ task, projectName, onClose }: TaskEditorProps) {
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
                    onClick={onClose}
                >
                    Save
                </button>
            </div>
        </Dialog>
    );
}
