import type { WeekPlan } from '@/core/types';
import {
    overallProgress,
    progressByDay,
    projectProgress,
    taskMisses,
    taskProgress,
} from '@/core/progress';
import { percentOf } from '@/core/math';
import { Dialog } from '@/components/shared/Dialog';
import { WeekSpark } from '@/components/shared/WeekSpark';
import { weekdayColumns } from '@/components/shared/sparkColumns';
import { PointsStat } from '@/components/shared/PointsStat';
import shell from '@/components/shared/dialogShell.module.css';
import { useCopy, useLocale } from '@/i18n/localeContext';
import styles from './WeekQuickLook.module.css';

type WeekQuickLookProps = {
    entry: WeekPlan;
    label: string;
    onClose: () => void;
    /** open this week on the plan board, where it is still read-only until reopened */
    onView: () => void;
};

/** Read-only look at one archived week. Stops above subtask level. */
export function WeekQuickLook({ entry, label, onClose, onView }: WeekQuickLookProps) {
    const { locale } = useLocale();
    const { weekQuickLook, common } = useCopy();
    const titleId = 'quicklook-title';
    const overall = overallProgress(entry.projects);
    const pct = Math.round(percentOf(overall.done, overall.total));

    return (
        <Dialog open onClose={onClose} labelledBy={titleId}>
            <div className={shell.head}>
                <div className={shell.eyebrow}>{weekQuickLook.eyebrow}</div>
                <h3 id={titleId} className={shell.title}>
                    {label}
                </h3>
            </div>
            <div className={styles.body}>
                <div className={styles.summary}>
                    <WeekSpark columns={weekdayColumns(progressByDay(entry.projects), locale)} />
                    <span className={styles.tot}>
                        <span className={styles.totNum}>{pct}%</span>
                        <span className={styles.totCap}>
                            {common.doneOf(overall.done, overall.total)}
                        </span>
                    </span>
                </div>
                {entry.projects.length === 0 ? (
                    <p className={styles.empty}>{weekQuickLook.empty}</p>
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
                                            {project.name || common.untitled}
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
                                                    {task.name || common.untitled}
                                                </span>
                                                {misses > 0 && (
                                                    <span className={styles.missChip}>
                                                        {weekQuickLook.missed(misses)}
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
                    {common.close}
                </button>
                <button type="button" className={`${shell.btn} ${shell.primary}`} onClick={onView}>
                    {weekQuickLook.view}
                </button>
            </div>
        </Dialog>
    );
}
