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
    /** whether this week has been ended, and so is a frozen record */
    ended: boolean;
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
    ended,
    compact = false,
    onToggleSubtask,
    onEditSubtask,
    onRequestMove,
    onClearMissed,
}: DayCellProps) {
    const { subtask, taskName, projectName } = entry;
    // A cell reads as missed for two reasons that mean the same thing to the user —
    // a day that went by without the work: the subtask was moved off this day, or
    // the week was closed out with it still not done. Only the first is RECORDED,
    // in missedDays, and only it has somewhere to point at ("now on Wed") or
    // anything to clear. The second is presentation only: writing it into
    // missedDays would record a miss on the subtask's own assigned day, which the
    // rep invariant forbids and which progressByDay would double-count.
    const showsMissed = isMissed || (ended && !subtask.isDone);
    // overdue = the live cell sitting on a past day, not done, on a week still
    // open. An ended week is settled, so there is nothing left to reschedule.
    const isOverdue =
        !showsMissed &&
        !subtask.isDone &&
        weekStatusOf(weekStart, today) === 'current' &&
        dayStatusOf(subtask.assignedDay, weekStart, today) === 'past';
    const cellClass = [
        styles.cell,
        compact && styles.compact,
        subtask.isDone && !isMissed && styles.done,
        showsMissed && styles.missed,
        isOverdue && styles.overdue,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <li className={cellClass}>
            <input
                type="checkbox"
                className={showsMissed ? `${check.box} ${styles.missedCheck}` : check.box}
                checked={subtask.isDone && !isMissed}
                disabled={isMissed || ended}
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

                {showsMissed ? (
                    <div className={styles.tagRow}>
                        <span className={`${styles.cellTag} ${styles.missTag}`}>
                            missed
                            {!compact && isMissed && ` · now on ${SHORT[subtask.assignedDay]}`}
                        </span>
                        {isMissed && (
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
                        )}
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
