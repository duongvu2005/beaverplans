import type { DayEntry } from '../core/daySchedule';
import type { DateKey, DayOfWeek } from '../core/types';
import { dayStatusOf, weekStatusOf } from '../core/dates';
import { MoveIcon } from './MoveIcon';
import { CloseIcon } from './CloseIcon';
import check from './checkbox.module.css';
import styles from './DayCell.module.css';

const SHORT: Record<DayOfWeek, string> = {
    mon: 'Mon',
    tue: 'Tue',
    wed: 'Wed',
    thu: 'Thu',
    fri: 'Fri',
    sat: 'Sat',
    sun: 'Sun',
};

type DayCellProps = {
    entry: DayEntry;
    day: DayOfWeek; // the weekday this cell is rendered under
    isMissed: boolean;
    weekStart: DateKey;
    today: DateKey;
    compact?: boolean;
    onToggleSubtask: (subtaskId: string) => void;
    onEditSubtask: (subtaskId: string) => void;
    onRequestMove: (subtaskId: string) => void;
    onClearMissed: (subtaskId: string, day: DayOfWeek) => void;
};

export function DayCell({
    entry,
    day,
    isMissed,
    weekStart,
    today,
    compact = false,
    onToggleSubtask,
    onEditSubtask,
    onRequestMove,
    onClearMissed,
}: DayCellProps) {
    const { subtask, taskName, projectName } = entry;
    // overdue = the live cell (not a missed ghost) sitting on a past day, not done
    const isOverdue =
        !isMissed &&
        !subtask.isDone &&
        weekStatusOf(weekStart, today) === 'current' &&
        dayStatusOf(subtask.assignedDay, weekStart, today) === 'past';
    const cellClass = [
        styles.cell,
        compact && styles.compact,
        subtask.isDone && !isMissed && styles.done,
        isMissed && styles.missed,
        isOverdue && styles.overdue,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <li className={cellClass}>
            <input
                type="checkbox"
                className={isMissed ? `${check.box} ${styles.missedCheck}` : check.box}
                checked={subtask.isDone && !isMissed}
                disabled={isMissed}
                onChange={() => onToggleSubtask(subtask.id)}
            />
            <div className={styles.text} onClick={() => onEditSubtask(subtask.id)}>
                <div className={styles.eyebrow}>
                    <span className={styles.project}>{projectName}</span>
                    <span className={styles.weight} aria-label={`weight ${subtask.weight} of 3`}>
                        {[1, 2, 3].map((n) => (
                            <span
                                key={n}
                                className={
                                    n <= subtask.weight ? `${styles.pip} ${styles.on}` : styles.pip
                                }
                            />
                        ))}
                    </span>
                </div>
                <div className={styles.task}>{taskName}</div>
                {subtask.description && <span className={styles.desc}>{subtask.description}</span>}

                {isMissed ? (
                    <div className={styles.tagRow}>
                        <span className={`${styles.cellTag} ${styles.missTag}`}>
                            missed{!compact && ` · now on ${SHORT[subtask.assignedDay]}`}
                        </span>
                        <button
                            type="button"
                            className={compact ? styles.clearBtn : styles.clearPill}
                            aria-label="Clear this missed mark"
                            title="Clear missed"
                            onClick={(e) => {
                                e.stopPropagation();
                                onClearMissed(subtask.id, day);
                            }}
                        >
                            <CloseIcon />
                            {!compact && <span>Clear</span>}
                        </button>
                    </div>
                ) : isOverdue ? (
                    <div className={styles.tagRow}>
                        <span className={`${styles.cellTag} ${styles.overdueTag}`}>
                            overdue{!compact && ' · reschedule?'}
                        </span>
                        <button
                            type="button"
                            className={compact ? styles.moveBtn : styles.movePill}
                            aria-label="Move to another day"
                            title="Move to another day"
                            onClick={(e) => {
                                e.stopPropagation();
                                onRequestMove(subtask.id);
                            }}
                        >
                            <MoveIcon />
                            {!compact && <span>Move</span>}
                        </button>
                    </div>
                ) : null}
            </div>
        </li>
    );
}
