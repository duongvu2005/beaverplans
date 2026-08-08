import type { WeekPlan } from '@/core/types';
import { overallProgress, progressByDay } from '@/core/progress';
import { percentOf } from '@/core/math';
import { WeekSpark } from './WeekSpark';
import { weekdayColumns } from './sparkColumns';
import { CopyIcon } from '@/components/shared/icons/CopyIcon';
import { CloseIcon } from '@/components/shared/icons/CloseIcon';
import styles from './ArchiveRow.module.css';

type ArchiveRowProps = {
    entry: WeekPlan;
    label: string;
    onOpen: () => void;
    onCopy: () => void;
    onDelete: () => void;
};

export function ArchiveRow({ entry, label, onOpen, onCopy, onDelete }: ArchiveRowProps) {
    const overall = overallProgress(entry.projects);
    const pct = Math.round(percentOf(overall.done, overall.total));
    const days = weekdayColumns(progressByDay(entry.projects));

    return (
        <div
            className={styles.row}
            role="button"
            tabIndex={0}
            onClick={onOpen}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpen();
                }
            }}
            aria-label={`Open archived week ${label}`}
        >
            <div className={styles.pline1}>
                <span className={styles.when}>
                    <span className={styles.date}>{label}</span>
                    <span className={styles.sub}>
                        {overall.done}/{overall.total} done
                    </span>
                </span>
                <span className={styles.stat}>
                    <span className={styles.pctBig}>{pct}%</span>
                    <span className={styles.complete}>complete</span>
                </span>
            </div>
            <div className={styles.pline2}>
                <WeekSpark columns={days} className={styles.spark} />
                {/* Siblings of the row's own click target, not nested inside it —
                    stopPropagation keeps their clicks from also opening the row. */}
                <span className={styles.actions}>
                    <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={(e) => {
                            e.stopPropagation();
                            onCopy();
                        }}
                        aria-label={`Copy week ${label} to clipboard`}
                    >
                        <CopyIcon />
                    </button>
                    <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete();
                        }}
                        aria-label={`Delete week ${label}`}
                    >
                        <CloseIcon />
                    </button>
                </span>
            </div>
        </div>
    );
}
