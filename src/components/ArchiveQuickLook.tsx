import type { WeekPlan } from '../core/types';
import {
    overallProgress,
    progressByDay,
    projectProgress,
    taskMisses,
    taskProgress,
} from '../core/progress';
import { percentOf } from '../core/math';
import { Dialog } from './Dialog';
import { WeekSpark } from './WeekSpark';
import { weekdayColumns } from './sparkColumns';
import { PointsStat } from './PointsStat';
import shell from './dialogShell.module.css';
import styles from './ArchiveQuickLook.module.css';

type ArchiveQuickLookProps = {
    entry: WeekPlan;
    label: string;
    onClose: () => void;
    onEdit: () => void;
};

/**
 * Read-only look at one archived week: the week's day shape and total, then a
 * project/task rollup with a chip counting where work slipped. Deliberately
 * stops above subtask level — a Subtask is a single day with no name, so a
 * subtask row would say almost nothing that Edit's real board doesn't say better.
 */
export function ArchiveQuickLook({ entry, label, onClose, onEdit }: ArchiveQuickLookProps) {
    const titleId = 'quicklook-title';
    const overall = overallProgress(entry.projects);
    const pct = Math.round(percentOf(overall.done, overall.total));

    return (
        <Dialog open onClose={onClose} labelledBy={titleId}>
            <div className={shell.head}>
                <div className={shell.eyebrow}>Archived week · read-only</div>
                <h3 id={titleId} className={shell.title}>
                    {label}
                </h3>
            </div>
            <div className={styles.body}>
                <div className={styles.summary}>
                    <WeekSpark columns={weekdayColumns(progressByDay(entry.projects))} />
                    <span className={styles.tot}>
                        <span className={styles.totNum}>{pct}%</span>
                        <span className={styles.totCap}>
                            {overall.done}/{overall.total} done
                        </span>
                    </span>
                </div>
                {entry.projects.length === 0 ? (
                    <p className={styles.empty}>This week was archived with nothing on it.</p>
                ) : (
                    <div>
                        {entry.projects.map((project) => {
                            const progress = projectProgress(project);
                            const done = progress.done === progress.total;
                            return (
                                <div key={project.id} className={styles.project}>
                                    <div className={styles.projectHead}>
                                        <span
                                            className={`${styles.projectName} ${done ? styles.done : ''}`}
                                        >
                                            {project.name || 'Untitled'}
                                        </span>
                                        <span className={styles.projectStat}>
                                            {progress.done}/{progress.total} ·{' '}
                                            {Math.round(percentOf(progress.done, progress.total))}%
                                        </span>
                                    </div>
                                    {project.tasks.map((task) => {
                                        const taskDone = taskProgress(task);
                                        const misses = taskMisses(task);
                                        return (
                                            <div key={task.id} className={styles.task}>
                                                <span
                                                    className={`${styles.taskName} ${
                                                        taskDone.done === taskDone.total
                                                            ? styles.done
                                                            : ''
                                                    }`}
                                                >
                                                    {task.name || 'Untitled'}
                                                </span>
                                                {misses > 0 && (
                                                    <span className={styles.missChip}>
                                                        {misses} missed
                                                    </span>
                                                )}
                                                <PointsStat {...taskDone} />
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            <div className={shell.foot}>
                <button type="button" className={`${shell.btn} ${shell.ghost}`} onClick={onClose}>
                    Close
                </button>
                <button type="button" className={`${shell.btn} ${shell.primary}`} onClick={onEdit}>
                    Edit
                </button>
            </div>
        </Dialog>
    );
}
