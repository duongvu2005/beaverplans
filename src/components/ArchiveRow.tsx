import type { DayOfWeek, WeekPlan } from '../core/types';
import { overallProgress, progressByDay } from '../core/progress';
import { percentOf } from '../core/math';
import { CopyIcon } from './CopyIcon';
import { CloseIcon } from './CloseIcon';
import styles from './ArchiveRow.module.css';

const LETTER: Record<DayOfWeek, string> = {
    mon: 'M',
    tue: 'T',
    wed: 'W',
    thu: 'T',
    fri: 'F',
    sat: 'S',
    sun: 'S',
};

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
    const days = progressByDay(entry.projects);
    const maxAssigned = Math.max(1, ...days.map((d) => d.assigned));

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
                <span className={styles.spark}>
                    {days.map((day) => {
                        const barPct = percentOf(day.assigned, maxAssigned);
                        const fillPct = percentOf(day.done, day.assigned);
                        return (
                            <span key={day.day} className={styles.col}>
                                <span className={styles.barTrack}>
                                    <span className={styles.bar} style={{ height: `${barPct}%` }}>
                                        <i style={{ height: `${fillPct}%` }} />
                                    </span>
                                </span>
                                <span className={styles.lab}>{LETTER[day.day]}</span>
                            </span>
                        );
                    })}
                </span>
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
