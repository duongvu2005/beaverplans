import { useState } from 'react';
import { Dialog } from '@/components/shared/Dialog';
import { parseDeadline } from '@/core/deadline';
import type { Project } from '@/core/types';
import shell from '@/components/shared/dialogShell.module.css';
import styles from './ProjectEditor.module.css';

type ProjectEditorProps = {
    project: Project;
    onClose: () => void;
    onSave: (deadline: string | undefined) => void;
};

export function ProjectEditor({ project, onClose, onSave }: ProjectEditorProps) {
    const stored = project.deadline ?? '';
    const seed = parseDeadline(stored).ok ? stored : ''; // ignore a corrupt stored value
    const [date, setDate] = useState(seed.slice(0, 10));
    const [time, setTime] = useState(seed.length > 10 ? seed.slice(11, 16) : '');

    const titleId = 'project-editor-title';

    function handleSave() {
        const deadline = date ? (time ? `${date}T${time}` : date) : undefined;
        onSave(deadline);
    }

    return (
        <Dialog open onClose={onClose} labelledBy={titleId}>
            <div className={shell.head}>
                <div className={shell.eyebrow}>Project</div>
                <h3 id={titleId} className={shell.title}>
                    {project.name || 'Project'}
                </h3>
            </div>
            <div className={shell.body}>
                <div className={shell.field}>
                    <div className={styles.deadlineHead}>
                        <label className={shell.label} htmlFor="project-deadline">
                            Deadline
                        </label>
                        {date && (
                            <button
                                type="button"
                                className={styles.clearDeadline}
                                onClick={() => {
                                    setDate('');
                                    setTime('');
                                }}
                            >
                                Clear
                            </button>
                        )}
                    </div>
                    <div className={styles.deadrow}>
                        <input
                            id="project-deadline"
                            type="date"
                            className={styles.date}
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                        <input
                            type="time"
                            className={styles.time}
                            value={time}
                            disabled={!date}
                            onChange={(e) => setTime(e.target.value)}
                        />
                    </div>
                </div>
            </div>
            <div className={shell.foot}>
                <button type="button" className={`${shell.btn} ${shell.ghost}`} onClick={onClose}>
                    Cancel
                </button>
                <button
                    type="button"
                    className={`${shell.btn} ${shell.primary}`}
                    onClick={handleSave}
                >
                    Save
                </button>
            </div>
        </Dialog>
    );
}
